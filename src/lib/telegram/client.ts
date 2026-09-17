import "server-only";

import { z } from "zod";

import { maskSecret } from "./escape";

/**
 * Thin Telegram Bot API client.
 *
 * Design constraints that shaped this file:
 *
 *  - **A leaked bot token is total control of the bot** (read every message,
 *    send as us, change the webhook). The token therefore never appears in a
 *    return value, a thrown error, or a log line: every string leaving this
 *    module passes through `redact()`, and the request URL - which necessarily
 *    embeds the token - is never stored on an error object.
 *  - **Never tight-loop against Telegram.** 429 responses carry the required
 *    backoff in `parameters.retry_after` (body, not just the `Retry-After`
 *    header), and we honour it, capped so a hostile/broken value cannot pin a
 *    serverless function open for its whole budget.
 *  - **Errors are values.** Callers are notification paths; a failed alert must
 *    not throw inside an order-fulfilment transaction. `callBotApi` resolves to
 *    a discriminated union. `callBotApiOrThrow` exists for the rare caller that
 *    wants an exception, and its message is redacted too.
 */

const TOKEN_ENV = "TELEGRAM_BOT_TOKEN";
const ADMIN_CHAT_ENV = "TELEGRAM_ADMIN_CHAT_ID";

const API_BASE = "https://api.telegram.org";

/** Per-attempt network timeout. */
const DEFAULT_TIMEOUT_MS = 10_000;
/** Attempts total, not retries: 3 == initial + 2 retries. */
const DEFAULT_MAX_ATTEMPTS = 3;
/** First backoff step; doubles each attempt with jitter. */
const DEFAULT_BASE_DELAY_MS = 500;
/** Never sleep longer than this for a single retry, whatever Telegram asks. */
const MAX_RETRY_DELAY_MS = 15_000;

/* -------------------------------------------------------------------------- */
/* Redaction                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Anything shaped like a bot token: `<digits>:<35+ url-safe chars>`.
 * Matched structurally so a *rotated* or *other* bot's token is caught too,
 * not just the one in this process's env.
 */
const TOKEN_SHAPE = /\d{5,16}:[A-Za-z0-9_-]{30,}/g;

/** `token=...`, `"secret": "..."`, `key: ...` in any casing. */
const SECRET_FIELD_SHAPE =
  /((?:^|[\s{,"'[(])(?:bot_?token|token|secret(?:_token)?|api_?key|key|password|authorization|auth)["']?\s*[:=]\s*["']?)([^\s"',;}\])&]+)/gi;

/**
 * Strip secrets from any value before it is logged, thrown, or returned.
 *
 * Order matters: the exact env token first (so it is removed even if it does
 * not match the generic shape), then the generic token shape, then
 * secret-named fields, then bare URL path segments.
 */
export function redact(input: unknown): string {
  let text = stringifyForLog(input);

  const live = process.env[TOKEN_ENV];
  if (live && live.length >= 8) {
    text = splitJoin(text, live, "[REDACTED_BOT_TOKEN]");
    // Also redact the secret half alone, in case only that part was captured.
    const half = live.includes(":") ? live.slice(live.indexOf(":") + 1) : "";
    if (half.length >= 8) text = splitJoin(text, half, "[REDACTED]");
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && secret.length >= 8) text = splitJoin(text, secret, "[REDACTED_WEBHOOK_SECRET]");

  text = text.replace(TOKEN_SHAPE, "[REDACTED_BOT_TOKEN]");
  text = text.replace(SECRET_FIELD_SHAPE, (_m, prefix: string, value: string) => {
    if (value.startsWith("[REDACTED")) return `${prefix}${value}`;
    return `${prefix}${maskSecret(value)}`;
  });
  // `/bot<token>/method` -> `/bot[REDACTED]/method`, belt and braces.
  text = text.replace(/\/bot[^/\s]+/gi, "/bot[REDACTED]");

  return text;
}

function splitJoin(haystack: string, needle: string, replacement: string): string {
  return haystack.split(needle).join(replacement);
}

function stringifyForLog(input: unknown): string {
  if (typeof input === "string") return input;
  if (input instanceof Error) {
    return `${input.name}: ${input.message}`;
  }
  if (input === null || input === undefined) return String(input);
  if (typeof input === "object") {
    try {
      return JSON.stringify(input, jsonSafeReplacer);
    } catch {
      return "[unserializable]";
    }
  }
  return String(input);
}

const SENSITIVE_KEY = /^(?:bot_?token|token|secret(?:_token)?|api_?key|key|password|authorization|auth|credential)s?$/i;

function jsonSafeReplacer(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  return value;
}

/** An `Error` whose `message` and `stack` are guaranteed redacted. */
export class TelegramApiError extends Error {
  readonly errorCode?: number;
  readonly retryAfter?: number;

  constructor(message: string, options: { errorCode?: number; retryAfter?: number } = {}) {
    super(redact(message));
    this.name = "TelegramApiError";
    this.errorCode = options.errorCode;
    this.retryAfter = options.retryAfter;
    // A stack captured through fetch can embed the request URL (and thus the
    // token). Rewrite it rather than trusting its provenance.
    if (this.stack) this.stack = redact(this.stack);
  }
}

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Read and shallow-validate the bot token.
 *
 * Fails loudly and *without echoing the value*: the message names the variable
 * and the problem, never the content.
 */
export function getBotToken(): string {
  const token = process.env[TOKEN_ENV];
  if (!token || !token.trim()) {
    throw new TelegramApiError(
      `${TOKEN_ENV} is not set. Add it to .env (chmod 600) - get it from BotFather. ` +
        `Do not use a NEXT_PUBLIC_ variable: that would ship the token to every browser.`,
    );
  }
  const trimmed = token.trim();
  if (!/^\d{5,16}:[A-Za-z0-9_-]{30,}$/.test(trimmed)) {
    throw new TelegramApiError(
      `${TOKEN_ENV} is set but is not shaped like a bot token (<bot_id>:<secret>). ` +
        `Value not shown. Re-copy it from BotFather.`,
    );
  }
  return trimmed;
}

/** The configured admin chat id, or `null` when unset. */
export function getAdminChatId(): string | null {
  const raw = process.env[ADMIN_CHAT_ENV]?.trim();
  if (!raw) return null;
  if (!/^-?\d{1,20}$/.test(raw)) {
    throw new TelegramApiError(`${ADMIN_CHAT_ENV} must be a numeric Telegram chat id.`);
  }
  return raw;
}

/** True when both token and admin chat are configured — cheap preflight. */
export function isTelegramConfigured(): boolean {
  try {
    getBotToken();
    return getAdminChatId() !== null;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Response schemas                                                           */
/* -------------------------------------------------------------------------- */

const responseParametersSchema = z.object({
  retry_after: z.number().int().nonnegative().optional(),
  migrate_to_chat_id: z.number().optional(),
});

const okResponseSchema = z.object({
  ok: z.literal(true),
  result: z.unknown(),
  description: z.string().optional(),
});

const errorResponseSchema = z.object({
  ok: z.literal(false),
  error_code: z.number().int().optional(),
  description: z.string().optional(),
  parameters: responseParametersSchema.optional(),
});

const botApiResponseSchema = z.union([okResponseSchema, errorResponseSchema]);

export type BotApiResult<T = unknown> =
  | { ok: true; result: T }
  | {
      ok: false;
      /** Short machine-readable class of failure. */
      kind: "config" | "network" | "timeout" | "rate_limited" | "api" | "invalid_response";
      /** Always redacted. Safe to log or persist. */
      error: string;
      errorCode?: number;
      retryAfter?: number;
      attempts: number;
    };

export interface CallOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
  /** Injectable for tests; defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests so retry paths don't actually sleep. */
  sleepImpl?: (ms: number) => Promise<void>;
  signal?: AbortSignal;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/* -------------------------------------------------------------------------- */
/* Core call                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Call a Bot API method.
 *
 * Retries on network errors, timeouts, 429 and 5xx. Does **not** retry 4xx
 * other than 429: a malformed request or a blocked chat will fail identically
 * forever, and retrying only burns the function's time budget.
 */
export async function callBotApi<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
  options: CallOptions = {},
): Promise<BotApiResult<T>> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    fetchImpl = globalThis.fetch,
    sleepImpl = defaultSleep,
    signal,
  } = options;

  let token: string;
  try {
    token = getBotToken();
  } catch (err) {
    return { ok: false, kind: "config", error: redact(err), attempts: 0 };
  }

  if (typeof fetchImpl !== "function") {
    return { ok: false, kind: "config", error: "No fetch implementation available.", attempts: 0 };
  }

  // Built per-call and never retained: the URL contains the token.
  const url = `${API_BASE}/bot${token}/${encodeURIComponent(method)}`;
  const body = JSON.stringify(stripUndefined(params));

  let last: Extract<BotApiResult<T>, { ok: false }> = {
    ok: false,
    kind: "network",
    error: "Request was never attempted.",
    attempts: 0,
  };

  for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt++) {
    if (signal?.aborted) {
      return { ok: false, kind: "timeout", error: "Aborted by caller.", attempts: attempt - 1 };
    }

    const outcome = await attemptCall<T>(url, method, body, { fetchImpl, timeoutMs, signal });

    if (outcome.ok) return outcome;

    last = { ...outcome, attempts: attempt };

    const isLast = attempt >= Math.max(1, maxAttempts);
    if (isLast || !isRetryable(outcome)) return last;

    await sleepImpl(backoffDelay(attempt, baseDelayMs, outcome.retryAfter));
  }

  return last;
}

/** Throwing variant. The thrown message is redacted. */
export async function callBotApiOrThrow<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
  options: CallOptions = {},
): Promise<T> {
  const res = await callBotApi<T>(method, params, options);
  if (res.ok) return res.result;
  throw new TelegramApiError(`Telegram ${method} failed (${res.kind}): ${res.error}`, {
    errorCode: res.errorCode,
    retryAfter: res.retryAfter,
  });
}

async function attemptCall<T>(
  url: string,
  method: string,
  body: string,
  ctx: { fetchImpl: typeof fetch; timeoutMs: number; signal?: AbortSignal },
): Promise<BotApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ctx.timeoutMs);
  const onAbort = () => controller.abort();
  ctx.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await ctx.fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await safeText(response);
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        ok: false,
        kind: response.status === 429 ? "rate_limited" : "invalid_response",
        error: redact(
          `HTTP ${response.status}: response was not JSON (${truncate(text, 200) || "<empty>"})`,
        ),
        errorCode: response.status,
        retryAfter: retryAfterFromHeader(response),
        attempts: 1,
      };
    }

    const parsed = botApiResponseSchema.safeParse(json);
    if (!parsed.success) {
      return {
        ok: false,
        kind: "invalid_response",
        error: redact(`HTTP ${response.status}: unexpected Bot API envelope`),
        errorCode: response.status,
        attempts: 1,
      };
    }

    if (parsed.data.ok) {
      return { ok: true, result: parsed.data.result as T };
    }

    // Telegram puts the mandated backoff in the *body*, not only the header.
    const retryAfter = parsed.data.parameters?.retry_after ?? retryAfterFromHeader(response);
    const code = parsed.data.error_code ?? response.status;
    return {
      ok: false,
      kind: code === 429 ? "rate_limited" : "api",
      error: redact(`${method} -> ${code}: ${parsed.data.description ?? "no description"}`),
      errorCode: code,
      retryAfter,
      attempts: 1,
    };
  } catch (err) {
    const aborted = isAbortError(err);
    return {
      ok: false,
      kind: aborted ? "timeout" : "network",
      // `redact` also scrubs any URL that leaked into the fetch error message.
      error: redact(aborted ? `${method} timed out after ${ctx.timeoutMs}ms` : err),
      attempts: 1,
    };
  } finally {
    clearTimeout(timer);
    ctx.signal?.removeEventListener("abort", onAbort);
  }
}

function isRetryable(res: Extract<BotApiResult<unknown>, { ok: false }>): boolean {
  if (res.kind === "network" || res.kind === "timeout" || res.kind === "rate_limited") return true;
  if (res.kind === "invalid_response") return true;
  if (res.kind === "api") {
    const code = res.errorCode ?? 0;
    return code >= 500 || code === 429;
  }
  return false; // config errors never resolve by retrying
}

/**
 * Exponential backoff with full jitter, floored by Telegram's `retry_after`
 * and hard-capped so a hostile `retry_after: 86400` cannot hang the request.
 */
export function backoffDelay(attempt: number, baseDelayMs: number, retryAfterSec?: number): number {
  if (typeof retryAfterSec === "number" && Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
    return Math.min(retryAfterSec * 1000, MAX_RETRY_DELAY_MS);
  }
  const exponential = baseDelayMs * 2 ** (attempt - 1);
  const jittered = exponential * (0.5 + Math.random() * 0.5);
  // The floor guarantees we never spin: even attempt 1 sleeps.
  return Math.max(50, Math.min(jittered, MAX_RETRY_DELAY_MS));
}

function retryAfterFromHeader(response: { headers?: { get?: (k: string) => string | null } }): number | undefined {
  const raw = response.headers?.get?.("retry-after");
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function safeText(response: { text?: () => Promise<string> }): Promise<string> {
  try {
    return (await response.text?.()) ?? "";
  } catch {
    return "";
  }
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    ("name" in err ? (err as { name?: string }).name === "AbortError" : false)
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}...` : s;
}

function stripUndefined(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export interface SendMessageOptions extends CallOptions {
  /**
   * Omit for plaintext. **Leave it omitted for anything containing provider or
   * customer content** - see `escape.ts`.
   */
  parseMode?: "HTML" | "MarkdownV2";
  /** Silent delivery: no sound/vibration. Use for `info`-severity alerts. */
  disableNotification?: boolean;
  disableWebPagePreview?: boolean;
  replyToMessageId?: number;
  messageThreadId?: number;
  /**
   * Inline keyboard. `callback_data` is capped at 64 bytes by the Bot API and
   * is attacker-visible in the client, so it must carry only opaque ids —
   * never amounts, balances or anything trusted on the way back in.
   */
  replyMarkup?: InlineKeyboardMarkup;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface TelegramMessage {
  message_id: number;
  date?: number;
  chat?: { id: number; type?: string; title?: string; username?: string };
  text?: string;
}

/** Send a message to an explicit chat id. */
export async function sendMessage(
  chatId: string | number,
  text: string,
  options: SendMessageOptions = {},
): Promise<BotApiResult<TelegramMessage>> {
  const {
    parseMode,
    disableNotification,
    disableWebPagePreview = true,
    replyToMessageId,
    messageThreadId,
    replyMarkup,
    ...call
  } = options;

  return callBotApi<TelegramMessage>(
    "sendMessage",
    {
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_notification: disableNotification,
      link_preview_options: disableWebPagePreview ? { is_disabled: true } : undefined,
      reply_parameters: replyToMessageId ? { message_id: replyToMessageId } : undefined,
      message_thread_id: messageThreadId,
      reply_markup: replyMarkup,
    },
    call,
  );
}

/**
 * Send to the configured admin chat.
 *
 * Plaintext by default: no `parse_mode` unless the caller explicitly opts in
 * for trusted static text.
 */
export async function sendMessageToAdmin(
  text: string,
  options: SendMessageOptions = {},
): Promise<BotApiResult<TelegramMessage>> {
  let chatId: string | null;
  try {
    chatId = getAdminChatId();
  } catch (err) {
    return { ok: false, kind: "config", error: redact(err), attempts: 0 };
  }
  if (!chatId) {
    return {
      ok: false,
      kind: "config",
      error: `${ADMIN_CHAT_ENV} is not set; cannot send admin alert.`,
      attempts: 0,
    };
  }
  return sendMessage(chatId, text, options);
}

export interface BotUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

/** Identity check. Cheap and safe; the canonical "is my token live?" probe. */
export function getMe(options: CallOptions = {}): Promise<BotApiResult<BotUser>> {
  return callBotApi<BotUser>("getMe", {}, options);
}

export interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
}

/**
 * Current webhook registration. An empty `url` means none is registered —
 * which is the expected state until a public URL exists.
 *
 * There is deliberately **no `setWebhook` helper here**: registration is a
 * one-time operator action, documented in `docs/telegram-setup.md`, not
 * something application code should ever do implicitly.
 */
export function getWebhookInfo(options: CallOptions = {}): Promise<BotApiResult<WebhookInfo>> {
  return callBotApi<WebhookInfo>("getWebhookInfo", {}, options);
}

/* -------------------------------------------------------------------------- */
/* Inline-keyboard callbacks                                                  */
/* -------------------------------------------------------------------------- */

export interface AnswerCallbackOptions extends CallOptions {
  /** Shown to the admin who tapped. Keep it short; Telegram caps it at 200. */
  text?: string;
  /** Modal alert instead of the default toast. */
  showAlert?: boolean;
}

/**
 * Acknowledge a button tap. Telegram shows a spinner on the button until this
 * lands, so it is called on every path — including rejected/failed ones.
 */
export function answerCallbackQuery(
  callbackQueryId: string,
  options: AnswerCallbackOptions = {},
): Promise<BotApiResult<boolean>> {
  const { text, showAlert, ...call } = options;
  return callBotApi<boolean>(
    "answerCallbackQuery",
    { callback_query_id: callbackQueryId, text, show_alert: showAlert },
    call,
  );
}

/**
 * Replace a message's text (and drop its keyboard unless one is supplied).
 * Used to retire the Approve/Reject buttons once a decision is recorded.
 */
export function editMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  options: SendMessageOptions = {},
): Promise<BotApiResult<TelegramMessage>> {
  const { parseMode, disableWebPagePreview = true, replyMarkup, ...call } = options;
  return callBotApi<TelegramMessage>(
    "editMessageText",
    {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: parseMode,
      link_preview_options: disableWebPagePreview ? { is_disabled: true } : undefined,
      reply_markup: replyMarkup,
    },
    call,
  );
}
