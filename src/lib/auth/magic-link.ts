import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../db";

const TOKEN_TTL_MIN = 15;

export const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

/** Create a single-use magic-link token for an email. Returns the raw token (goes in the URL; only the hash is stored). */
export async function issueLoginToken(email: string): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await prisma.loginToken.create({
    data: {
      tokenHash: hashToken(raw),
      email: email.toLowerCase().trim(),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MIN * 60 * 1000),
    },
  });
  return raw;
}

/**
 * Consume a magic-link token: single-use, atomic. Returns the email or null.
 * updateMany's WHERE makes consumption race-safe — two concurrent requests
 * can't both get count=1 for the same token.
 */
export async function consumeLoginToken(raw: string): Promise<string | null> {
  const tokenHash = hashToken(raw);
  const { count } = await prisma.loginToken.updateMany({
    where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });
  if (count !== 1) return null;
  const row = await prisma.loginToken.findUnique({ where: { tokenHash } });
  return row?.email ?? null;
}
