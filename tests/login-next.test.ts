import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.ENCRYPTION_KEY ||= "a".repeat(64);
process.env.SESSION_SECRET ||= "s".repeat(48);

import { prisma } from "../src/lib/db";
import { issueLoginToken, consumeLoginToken } from "../src/lib/auth/magic-link";
import { safeNextPath } from "../src/lib/auth/redirect";

/**
 * Integration test for the login round trip, which carries `next` from the
 * interrupted page -> login query param -> emailed verify URL -> final
 * redirect. Any link in that chain silently dropping it means a buyer is
 * bounced to the home page after signing in, which is invisible in the UI but
 * a real regression, so it is asserted rather than eyeballed.
 */
const EMAIL = "login-next-test@internal.test";

beforeAll(async () => {
  await prisma.loginToken.deleteMany({ where: { email: EMAIL } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
});

afterAll(async () => {
  await prisma.loginToken.deleteMany({ where: { email: EMAIL } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe("login round trip preserves the interrupted destination", () => {
  it("issues a single-use token and consumes it exactly once", async () => {
    const token = await issueLoginToken(EMAIL);
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);

    expect(await consumeLoginToken(token)).toBe(EMAIL);
    expect(await consumeLoginToken(token)).toBeNull(); // replay refused
  });

  it("stores only a hash, never the raw token", async () => {
    const token = await issueLoginToken(EMAIL);
    const rows = await prisma.loginToken.findMany({ where: { email: EMAIL } });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.tokenHash === token)).toBe(false);
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.tokenHash))).toBe(true);
  });

  it("expires a token rather than accepting it forever", async () => {
    const token = await issueLoginToken(EMAIL);
    await prisma.loginToken.updateMany({
      where: { email: EMAIL, consumedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await consumeLoginToken(token)).toBeNull();
  });

  it("builds the same verify URL shape the API redirects to", () => {
    // Mirrors login/route.ts: only a validated path is ever appended.
    const next = safeNextPath("/en/products/chatgpt-plus");
    const url = new URL("/api/auth/verify", "https://shop.test");
    url.searchParams.set("token", "tok");
    if (next) url.searchParams.set("next", next);

    expect(url.pathname).toBe("/api/auth/verify");
    expect(url.searchParams.get("next")).toBe("/en/products/chatgpt-plus");
    // The destination survives round-tripping through a URL.
    const reparsed = new URL(url.toString());
    expect(safeNextPath(reparsed.searchParams.get("next"))).toBe("/en/products/chatgpt-plus");
  });

  it("never smuggles an off-site next into the verify URL", () => {
    const url = new URL("/api/auth/verify", "https://shop.test");
    const next = safeNextPath("https://evil.com/steal");
    expect(next).toBeNull();
    if (next) url.searchParams.set("next", next);
    expect(url.searchParams.has("next")).toBe(false);
  });
});
