import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";
import { createHash, createHmac } from "node:crypto";

vi.mock("server-only", () => ({}));

import { encodeSession, decodeSession } from "../src/lib/auth/session";
import { verifyTelegramLogin } from "../src/lib/auth/telegram-login";
import { rateLimit } from "../src/lib/auth/rate-limit";

const BOT_TOKEN = "1234567:" + "A".repeat(35);

beforeEach(() => {
  process.env.SESSION_SECRET = "s".repeat(48);
  process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
});

describe("session cookie", () => {
  it("round-trips a valid session", () => {
    const s = { userId: "u1", role: "CUSTOMER" as const, exp: Date.now() + 60_000 };
    expect(decodeSession(encodeSession(s))).toEqual(s);
  });

  it("rejects tampered payload, bad mac, expiry, garbage", () => {
    const token = encodeSession({ userId: "u1", role: "CUSTOMER", exp: Date.now() + 60_000 });
    const [payload, mac] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ userId: "u1", role: "ADMIN", exp: Date.now() + 60_000 })).toString("base64url");
    expect(decodeSession(`${forged}.${mac}`)).toBeNull();
    expect(decodeSession(`${payload}.${"0".repeat(mac.length)}`)).toBeNull();
    expect(decodeSession(encodeSession({ userId: "u1", role: "CUSTOMER", exp: Date.now() - 1 }))).toBeNull();
    expect(decodeSession("not-a-token")).toBeNull();
    expect(decodeSession(undefined)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = encodeSession({ userId: "u1", role: "CUSTOMER", exp: Date.now() + 60_000 });
    process.env.SESSION_SECRET = "x".repeat(48);
    expect(decodeSession(token)).toBeNull();
  });
});

describe("telegram login verification", () => {
  function signedPayload(fields: Record<string, string>) {
    const checkString = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
    const key = createHash("sha256").update(BOT_TOKEN).digest();
    const hash = createHmac("sha256", key).update(checkString).digest("hex");
    return { ...fields, hash };
  }

  const fresh = () => ({
    id: "42",
    first_name: "Alice",
    username: "alice",
    auth_date: String(Math.floor(Date.now() / 1000)),
  });

  it("accepts a correctly signed fresh payload", () => {
    const result = verifyTelegramLogin(signedPayload(fresh()));
    expect(result).not.toBeNull();
    expect(result!.id).toBe(42);
    expect(result!.username).toBe("alice");
  });

  it("rejects tampered fields, missing hash, stale auth_date", () => {
    const good = signedPayload(fresh());
    expect(verifyTelegramLogin({ ...good, id: "43" })).toBeNull();
    expect(verifyTelegramLogin({ ...fresh() })).toBeNull();
    const stale = fresh();
    stale.auth_date = String(Math.floor(Date.now() / 1000) - 3600);
    expect(verifyTelegramLogin(signedPayload(stale))).toBeNull();
  });
});

describe("rate limit", () => {
  it("allows up to limit, blocks after, resets after window", () => {
    vi.useFakeTimers();
    try {
      const key = `test:${Math.random()}`;
      expect(rateLimit(key, 2, 1000)).toBe(true);
      expect(rateLimit(key, 2, 1000)).toBe(true);
      expect(rateLimit(key, 2, 1000)).toBe(false);
      vi.advanceTimersByTime(1001);
      expect(rateLimit(key, 2, 1000)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
