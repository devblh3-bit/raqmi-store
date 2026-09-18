import { NextResponse } from "next/server";
import { z } from "zod";
import { issueLoginToken } from "@/lib/auth/magic-link";
import { sendLoginEmail } from "@/lib/auth/email";
import { rateLimit } from "@/lib/auth/rate-limit";
import { safeNextPath } from "@/lib/auth/redirect";

const schema = z.object({
  email: z.string().email().max(254),
  next: z.string().max(512).optional(),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`login:ip:${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();
  const next = safeNextPath(parsed.data.next);

  // Per-email cap too: x-forwarded-for is client-controllable without a trusted proxy.
  if (!rateLimit(`login:email:${email}`, 3, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const token = await issueLoginToken(email);
  const url = new URL("/api/auth/verify", base);
  url.searchParams.set("token", token);
  if (next) url.searchParams.set("next", next);

  try {
    await sendLoginEmail(email, url.toString());
  } catch (e) {
    console.error("[auth] send failed:", e);
    return NextResponse.json({ error: "could not send email" }, { status: 502 });
  }
  // Same response whether or not the account exists — no user enumeration.
  return NextResponse.json({ ok: true });
}
