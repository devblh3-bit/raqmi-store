import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.ENCRYPTION_KEY ||= "a".repeat(64);
process.env.SESSION_SECRET ||= "s".repeat(48);

// createSession writes through next/headers cookies(), which only works inside
// a real request scope. Stub just that boundary so the route's own redirect
// logic (the thing that broke) stays under test.
const sessions = vi.hoisted(() => ({ created: [] as string[] }));
vi.mock("../src/lib/auth/session", () => ({
  createSession: async (userId: string) => {
    sessions.created.push(userId);
  },
  getSession: async () => null,
}));

import { prisma } from "../src/lib/db";
import { GET } from "../src/app/api/auth/verify/route";
import { issueLoginToken } from "../src/lib/auth/magic-link";

/**
 * Exercises the real route handler, not just the pieces it uses.
 *
 * A 500 here is easy to miss: the failure path built its redirect target with
 * `new URL('/path')`, which throws "Invalid URL" on a relative path, so an
 * expired link produced a server error instead of a friendly retry. Unit tests
 * on safeNextPath could not catch that, because the bug was in URL construction.
 */
const EMAIL = "verify-route-test@internal.test";

beforeAll(async () => {
  await prisma.loginToken.deleteMany({ where: { email: EMAIL } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
});

afterAll(async () => {
  await prisma.loginToken.deleteMany({ where: { email: EMAIL } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

const call = (query: string) =>
  GET(new Request(`http://localhost:3000/api/auth/verify${query}`));

describe("GET /api/auth/verify", () => {
  it("redirects to login with an error when the token is missing", async () => {
    const res = await call("");
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/en/login");
    expect(loc.searchParams.get("error")).toBe("invalid");
  });

  it("preserves a valid next when reporting failure", async () => {
    const res = await call("?next=%2Fen%2Faccount");
    const loc = new URL(res.headers.get("location")!);
    expect(loc.searchParams.get("next")).toBe("/en/account");
  });

  it("drops an off-site next instead of echoing it", async () => {
    const res = await call("?next=" + encodeURIComponent("https://evil.com"));
    const location = res.headers.get("location")!;
    expect(location).not.toContain("evil.com");
    expect(new URL(location).searchParams.has("next")).toBe(false);
  });

  it("rejects an unknown or spent token without throwing", async () => {
    expect((await call("?token=not-a-real-token")).status).toBe(307);

    const token = await issueLoginToken(EMAIL);
    const first = await call(`?token=${token}`);
    expect(first.status).toBe(307);
    // Second use of the same link must fail closed, not 500.
    const replay = await call(`?token=${token}`);
    expect(replay.status).toBe(307);
    expect(new URL(replay.headers.get("location")!).searchParams.get("error")).toBe("invalid");
  });

  it("signs in on a good token and honours next", async () => {
    sessions.created.length = 0;
    const token = await issueLoginToken(EMAIL);
    const res = await call(`?token=${token}&next=%2Ffr%2Fwallet`);

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/fr/wallet");
    expect(sessions.created).toHaveLength(1); // a session was established

    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    expect(user).not.toBeNull();
  });

  it("lands on the preferred locale when no next is given", async () => {
    const token = await issueLoginToken(EMAIL);
    const res = await call(`?token=${token}`);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/en");
  });
});
