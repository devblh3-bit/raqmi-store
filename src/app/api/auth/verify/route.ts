import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { consumeLoginToken } from "@/lib/auth/magic-link";
import { createSession } from "@/lib/auth/session";
import { defaultLocale } from "@/i18n";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const fail = NextResponse.redirect(new URL(`/${defaultLocale}/login?error=invalid`, url));
  if (!token) return fail;

  const email = await consumeLoginToken(token);
  if (!email) return fail;

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });
  await createSession(user.id, user.role);
  return NextResponse.redirect(new URL(`/${user.preferredLocale}`, url));
}
