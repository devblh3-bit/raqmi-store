import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { UserRole } from "@prisma/client";

// ponytail: stdlib HMAC-signed cookie instead of installing jose. Same integrity
// guarantee (HS256-equivalent); upgrade path is jose if we ever need key rotation
// or third-party JWT interop.

const COOKIE = "session";
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle timeout for standard sessions
export const SESSION_DAYS_STANDARD = 1; // 1 day absolute cap for standard sessions
export const SESSION_DAYS_REMEMBER = 30; // 30 days persistent for "Stay logged in"

export type Session = {
  userId: string;
  role: UserRole;
  exp: number;
  lastActive?: number;
  remember?: boolean;
};

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

    // Disconnect inactive users if "Stay logged in" was not checked
    if (!session.remember && session.lastActive) {
      if (Date.now() - session.lastActive > IDLE_TIMEOUT_MS) {
        return null;
      }
    }

    return session;
  } catch {
    return null;
  }
}

export async function createSession(
  userId: string,
  role: UserRole,
  options?: { remember?: boolean },
): Promise<void> {
  const remember = Boolean(options?.remember);
  const maxAgeDays = remember ? SESSION_DAYS_REMEMBER : SESSION_DAYS_STANDARD;
  const now = Date.now();
  const exp = now + maxAgeDays * 24 * 60 * 60 * 1000;
  const session: Session = {
    userId,
    role,
    exp,
    lastActive: now,
    remember,
  };
  const store = await cookies();
  store.set(COOKIE, encodeSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(exp),
  });
}

/** Slides the active idle window forward during active usage. */
export async function touchSession(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  const session = decodeSession(token);
  if (!session) return false;

  const now = Date.now();
  // Throttle updates: only re-write if at least 1 minute has elapsed
  if (session.lastActive && now - session.lastActive < 60_000) {
    return true;
  }

  session.lastActive = now;
  store.set(COOKIE, encodeSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(session.exp),
  });
  return true;
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return decodeSession(store.get(COOKIE)?.value);
}

export async function deleteSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export function isSessionIdle(session: Session, timeoutMs = IDLE_TIMEOUT_MS): boolean {
  if (!session.lastActive) return false;
  return Date.now() - session.lastActive > timeoutMs;
}
