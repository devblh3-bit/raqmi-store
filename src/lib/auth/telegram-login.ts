import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getBotToken } from "../telegram/client";

const AUTH_MAX_AGE_SEC = 5 * 60;

export type TelegramLoginPayload = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

/**
 * Verify a Telegram Login Widget payload per https://core.telegram.org/widgets/login
 * key = SHA256(bot_token); data-check-string = sorted `k=v` lines minus `hash`.
 * Returns the payload on success, null on any failure (never throws on bad input).
 */
export function verifyTelegramLogin(data: Record<string, string>): TelegramLoginPayload | null {
  const { hash, ...rest } = data;
  if (!hash || !rest.id || !rest.auth_date) return null;

  const checkString = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join("\n");
  const key = createHash("sha256").update(getBotToken()).digest();
  const expected = createHmac("sha256", key).update(checkString).digest("hex");

  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const authDate = Number(rest.auth_date);
  if (!Number.isFinite(authDate) || Math.abs(Date.now() / 1000 - authDate) > AUTH_MAX_AGE_SEC)
    return null;

  const id = Number(rest.id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  return { ...rest, id, auth_date: authDate, hash } as TelegramLoginPayload;
}
