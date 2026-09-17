import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  handleTelegramWebhook,
  type DepositDecision,
  type WebhookDeps,
} from "../src/lib/telegram/webhook";

const SECRET = "whsec_callback_test";
const ADMIN_ID = 777001;
const OUTSIDER_ID = 999999;

const headers = (secret: string | null = SECRET) =>
  ({ get: (n: string) => (n === "x-telegram-bot-api-secret-token" ? secret : null) });

type Reviewed = { id: string; decision: DepositDecision };

function deps(overrides: Partial<WebhookDeps> = {}) {
  const reviewed: Reviewed[] = [];
  const answered: { id: string; text?: string }[] = [];
  const edited: { messageId: number; text: string }[] = [];

  const base: WebhookDeps = {
    reviewDeposit: async (id, decision) => {
      reviewed.push({ id, decision });
      return { status: decision === "approve" ? "APPROVED" : "REJECTED", alreadyHandled: false };
    },
    answerCallback: (async (id: string, opts?: { text?: string }) => {
      answered.push({ id, text: opts?.text });
      return { ok: true, result: true };
    }) as WebhookDeps["answerCallback"],
    editMessage: (async (_chat: unknown, messageId: number, text: string) => {
      edited.push({ messageId, text });
      return { ok: true, result: { message_id: messageId } };
    }) as WebhookDeps["editMessage"],
    ...overrides,
  };
  return { deps: base, reviewed, answered, edited };
}

const tap = (data: string, fromId = ADMIN_ID, chatId = ADMIN_ID) => ({
  update_id: 1,
  callback_query: {
    id: "cbq-1",
    data,
    from: { id: fromId },
    message: { message_id: 42, chat: { id: chatId }, text: "[INFO] Deposit awaiting confirmation" },
  },
});

beforeEach(() => {
  vi.stubEnv("TELEGRAM_ADMIN_CHAT_ID", String(ADMIN_ID));
  vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", SECRET);
});
afterEach(() => vi.unstubAllEnvs());

describe("deposit approve/reject taps", () => {
  it("approves when the admin taps Approve, then retires the buttons", async () => {
    const { deps: d, reviewed, answered, edited } = deps();

    const res = await handleTelegramWebhook(headers(), tap("dep:ok:dep_abc123"), d);

    expect(res.status).toBe(200);
    expect(reviewed).toEqual([{ id: "dep_abc123", decision: "approve" }]);
    expect(answered[0].text).toMatch(/approved/i);
    expect(edited[0].messageId).toBe(42);
  });

  it("rejects on the Reject button", async () => {
    const { deps: d, reviewed, answered } = deps();
    await handleTelegramWebhook(headers(), tap("dep:no:dep_xyz"), d);
    expect(reviewed).toEqual([{ id: "dep_xyz", decision: "reject" }]);
    expect(answered[0].text).toMatch(/rejected/i);
  });

  it("reports an already-decided deposit without re-crediting", async () => {
    const { deps: d, answered } = deps({
      reviewDeposit: async () => ({ status: "APPROVED", alreadyHandled: true }),
    });
    await handleTelegramWebhook(headers(), tap("dep:ok:dep_abc"), d);
    expect(answered[0].text).toMatch(/already approved/i);
  });

  it("refuses a tap from a non-admin user in the admin chat", async () => {
    const { deps: d, reviewed, answered } = deps();

    await handleTelegramWebhook(headers(), tap("dep:ok:dep_abc", OUTSIDER_ID, ADMIN_ID), d);

    expect(reviewed).toHaveLength(0); // no money moved
    expect(answered[0].text).toMatch(/not authorized/i);
  });

  it("refuses a tap in a chat that is not the admin chat", async () => {
    const { deps: d, reviewed } = deps();
    await handleTelegramWebhook(headers(), tap("dep:ok:dep_abc", ADMIN_ID, OUTSIDER_ID), d);
    expect(reviewed).toHaveLength(0);
  });

  it("rejects the delivery entirely without a valid secret token", async () => {
    const { deps: d, reviewed } = deps();
    const res = await handleTelegramWebhook(headers("wrong-secret"), tap("dep:ok:dep_abc"), d);
    expect(res.status).toBe(401);
    expect(reviewed).toHaveLength(0);
  });

  it("ignores malformed or injected callback data", async () => {
    const { deps: d, reviewed, answered } = deps();

    for (const data of [
      "dep:ok:",                       // no id
      "dep:maybe:dep_abc",             // unknown verb
      "dep:ok:dep_abc;DROP TABLE",     // punctuation outside the charset
      "something-else",
      "dep:ok:" + "a".repeat(60),      // id longer than the pattern allows
    ]) {
      await handleTelegramWebhook(headers(), tap(data), d);
    }

    expect(reviewed).toHaveLength(0);
    expect(answered.every((a) => /unrecognized/i.test(a.text ?? ""))).toBe(true);
  });

  it("answers the tap and keeps the buttons when the review throws", async () => {
    const { deps: d, answered, edited } = deps({
      reviewDeposit: async () => {
        throw new Error("db down");
      },
    });

    const res = await handleTelegramWebhook(headers(), tap("dep:ok:dep_abc"), d);

    expect(res.status).toBe(200); // never 5xx: Telegram would redeliver forever
    expect(answered[0].text).toMatch(/try again/i);
    expect(edited).toHaveLength(0); // buttons stay so it can be retried
  });

  it("acks safely when no review handler is wired", async () => {
    const { deps: d, answered } = deps({ reviewDeposit: undefined });
    const res = await handleTelegramWebhook(headers(), tap("dep:ok:dep_abc"), d);
    expect(res.status).toBe(200);
    expect(answered[0].text).toMatch(/unavailable/i);
  });
});
