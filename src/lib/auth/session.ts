import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { UserRole } from "@prisma/client";

// ponytail: stdlib HMAC-signed cookie instead of installing jose. Same integrity
// guarantee (HS256-equivalent); upgrade path is jose if we ever need key rotation
// or third-party JWT interop.

const COOKIE = "session";
const SESSION_DAYS = 7;

export type Session = { userId: string; role: UserRole; exp: number };

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.trim().length < 32) {
    throw new Error(
      "SESSION_SECRET is not set (need >=32 chars). Generate: openssl rand -base64 48",
    );
  }
  return s.trim();
}

const sign = (payload: string) =>
  createHmac("sha256", secret()).update(payload).digest("base64url");

export function encodeSession(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (typeof session.userId !== "string" || typeof session.exp !== "number") return null;
    if (session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function createSession(userId: string, role: UserRole): Promise<void> {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const store = await cookies();
  store.set(COOKIE, encodeSession({ userId, role, exp }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(exp),
  });
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return decodeSession(store.get(COOKIE)?.value);
}

export async function deleteSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
