import "server-only";

import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

import {
  answerCallbackQuery,
  editMessageText,
  sendMessage,
  type BotApiResult,
  type TelegramMessage,
} from "./client";

/**
 * Framework-agnostic webhook handler. The future
 * `app/api/telegram/webhook/route.ts` wraps this:
 *
 *   export async function POST(req: Request) {
 *     const res = await handleTelegramWebhook(req.headers, await req.json().catch(() => null));
 *     return new Response(res.body, { status: res.status });
 *   }
 *
 * Security posture:
 *  - secret-token check FAILS CLOSED (env unset or header missing => 401)
 *  - constant-time compare with a length guard (timingSafeEqual throws on
 *    unequal lengths, so lengths are checked first — that leaks only length,
 *    which the attacker does not control anyway)
 *  - non-admin chats are acked with 200 and never processed: a non-2xx would
 *    make Telegram redeliver the hostile update forever
 *  - replies are static strings, plaintext, never echoing update content
 */

const SECRET_HEADER = "x-telegram-bot-api-secret-token";

export interface WebhookResponse {
  status: number;
  body: string;
}

/** Minimal header access: a Fetch `Headers` or a plain record both fit. */
export type HeaderSource =
  | { get(name: string): string | null }
  | Record<string, string | string[] | undefined>;

function getHeader(headers: HeaderSource, name: string): string | null {
  if (typeof (headers as { get?: unknown }).get === "function") {
    return (headers as { get(n: string): string | null }).get(name);
  }
  const record = headers as Record<string, string | string[] | undefined>;
  const raw = record[name] ?? record[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

/** Constant-time string equality with a length guard. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verify `X-Telegram-Bot-Api-Secret-Token`. Fail closed: no configured
 * secret, or no header, means reject.
 */
export function verifySecretToken(headers: HeaderSource): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || !expected.trim()) return false;
  const presented = getHeader(headers, SECRET_HEADER);
  if (!presented) return false;
  return safeEqual(presented, expected);
}

/* -------------------------------------------------------------------------- */
/* Update parsing — everything is unknown until zod says otherwise            */
/* -------------------------------------------------------------------------- */

const updateSchema = z.object({
  update_id: z.number().int(),
  message: z
    .object({
      message_id: z.number().int(),
      chat: z.object({ id: z.number() }),
      text: z.string().max(8192).optional(),
    })
    // Telegram sends many more fields; ignore them all.
    .loose()
    .optional(),
  callback_query: z
    .object({
      id: z.string().max(128),
      // 64 bytes is the Bot API cap; anything longer is not ours.
      data: z.string().max(64).optional(),
      message: z
        .object({
          message_id: z.number().int(),
          chat: z.object({ id: z.number() }),
          text: z.string().max(8192).optional(),
        })
        .loose()
        .optional(),
      from: z.object({ id: z.number() }).loose().optional(),
    })
    .loose()
    .optional(),
});

/** `dep:ok:<id>` / `dep:no:<id>` — opaque id only, never an amount. */
const CALLBACK_PATTERN = /^dep:(ok|no):([A-Za-z0-9_-]{1,50})$/;

/* -------------------------------------------------------------------------- */
/* Commands — static replies only, plaintext, no echo of input                */
/* -------------------------------------------------------------------------- */

const START_REPLY =
  "Store admin bot connected.\n" +
  "This chat receives operational alerts (stock, providers, deposits, applications).\n" +
  "Commands: /help";

const HELP_REPLY =
  "Commands:\n" +
  "/start - confirm the bot is connected\n" +
  "/help - this message\n" +
  "Alerts are pushed automatically; there is nothing else to configure here.";

type SendFn = (chatId: number, text: string) => Promise<BotApiResult<TelegramMessage>>;

export type DepositDecision = "approve" | "reject";

export interface DepositReviewResult {
  /** Final status after the call, e.g. APPROVED / REJECTED. */
  status: string;
  /** True when someone (or a redelivery) already decided this one. */
  alreadyHandled: boolean;
}

export type ReviewDepositFn = (
  depositId: string,
  decision: DepositDecision,
) => Promise<DepositReviewResult>;

export interface WebhookDeps {
  /** Injectable for tests; defaults to the real client. */
  send?: SendFn;
  /**
   * Applies an admin's Approve/Reject tap. Injected rather than imported so
   * this module stays Prisma-free (see module docstring). Without it, taps are
   * acknowledged and dropped instead of silently doing nothing.
   */
  reviewDeposit?: ReviewDepositFn;
  answerCallback?: typeof answerCallbackQuery;
  editMessage?: typeof editMessageText;
}

/**
 * Handle one webhook delivery. Always resolves; never throws for bad input.
 *
 * Return contract: 401 only for a failed/missing secret. Everything after
 * authentication is 200 — including junk bodies and non-admin updates — so
 * Telegram never retries and an attacker learns nothing from the status code.
 */
export async function handleTelegramWebhook(
  headers: HeaderSource,
  body: unknown,
  deps: WebhookDeps = {},
): Promise<WebhookResponse> {
  if (!verifySecretToken(headers)) {
    return { status: 401, body: "unauthorized" };
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return { status: 200, body: "ok" }; // junk: ack, drop

  // Admin gate BEFORE any handling. Silently ack everyone else.
  const adminRaw = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  const adminId = adminRaw ? Number(adminRaw) : NaN;
  if (!Number.isFinite(adminId)) return { status: 200, body: "ok" };

  const callback = parsed.data.callback_query;
  if (callback) {
    await handleDepositCallback(callback, adminId, deps);
    return { status: 200, body: "ok" };
  }

  const message = parsed.data.message;
  if (!message?.text) return { status: 200, body: "ok" };
  if (message.chat.id !== adminId) return { status: 200, body: "ok" };

  const send: SendFn = deps.send ?? ((chatId, text) => sendMessage(chatId, text));
  const command = message.text.trim().split(/[\s@]/, 1)[0];

  switch (command) {
    case "/start":
      await send(message.chat.id, START_REPLY);
      break;
    case "/help":
      await send(message.chat.id, HELP_REPLY);
      break;
    default:
      // Unknown text from the admin: static nudge, never echo their input.
      await send(message.chat.id, "Unknown command. Try /help.");
  }

  return { status: 200, body: "ok" };
}

/* -------------------------------------------------------------------------- */
/* Deposit approve/reject taps                                                */
/* -------------------------------------------------------------------------- */

type CallbackQuery = NonNullable<z.infer<typeof updateSchema>["callback_query"]>;

/**
 * Apply one Approve/Reject tap.
 *
 * Money moves here, so the gate is strict: the tap must come from the admin
 * chat AND the admin user id. `callback_data` supplies only an opaque deposit
 * id — the amount and recipient are re-read from the database by the injected
 * review function, never taken from the button.
 *
 * Always answers the callback (Telegram spins the button until we do) and
 * never throws: an exception here would turn into a non-2xx and make Telegram
 * redeliver the same tap forever.
 */
async function handleDepositCallback(
  callback: CallbackQuery,
  adminId: number,
  deps: WebhookDeps,
): Promise<void> {
  const answer = deps.answerCallback ?? answerCallbackQuery;
  const edit = deps.editMessage ?? editMessageText;

  const fromId = callback.from?.id;
  const chatId = callback.message?.chat.id;
  // Both must be the admin: the chat alone would let anyone who can post in it
  // move money, and from-id alone ignores which chat the button lives in.
  if (chatId !== adminId || fromId !== adminId) {
    await answer(callback.id, { text: "Not authorized." }).catch(() => {});
    return;
  }

  const match = callback.data ? CALLBACK_PATTERN.exec(callback.data) : null;
  if (!match) {
    await answer(callback.id, { text: "Unrecognized action." }).catch(() => {});
    return;
  }
  const [, verb, depositId] = match;
  const decision: DepositDecision = verb === "ok" ? "approve" : "reject";

  const review = deps.reviewDeposit;
  if (!review) {
    await answer(callback.id, { text: "Review handler unavailable." }).catch(() => {});
    return;
  }

  let outcome: DepositReviewResult;
  try {
    outcome = await review(depositId, decision);
  } catch {
    // Detail stays in the caller's logs; the admin gets a retryable message
    // and the buttons are deliberately left in place.
    await answer(callback.id, { text: "Failed — try again." }).catch(() => {});
    return;
  }

  const verdict = outcome.alreadyHandled
    ? `Already ${outcome.status.toLowerCase()}.`
    : decision === "approve"
      ? "Approved and credited."
      : "Rejected.";

  await answer(callback.id, { text: verdict }).catch(() => {});

  // Retire the keyboard so the decision cannot be double-tapped from the UI.
  // (approveDeposit is idempotent anyway; this is the cosmetic half.)
  if (callback.message) {
    const original = callback.message.text ?? "Deposit";
    await edit(chatId, callback.message.message_id, `${original}\n\n— ${verdict}`, {
      replyMarkup: { inline_keyboard: [] },
    }).catch(() => {});
  }
}
