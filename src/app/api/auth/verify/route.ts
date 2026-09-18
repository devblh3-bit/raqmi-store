import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { consumeLoginToken } from "@/lib/auth/magic-link";
import { createSession } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/redirect";
import { defaultLocale } from "@/i18n";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const next = safeNextPath(url.searchParams.get("next"));

  const fail = new URL(`/${defaultLocale}/login?error=invalid`);
  if (next) fail.searchParams.set("next", next);
  if (!token) return NextResponse.redirect(new URL(fail, url));

  const email = await consumeLoginToken(token);
  if (!email) return NextResponse.redirect(new URL(fail, url));

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });
  await createSession(user.id, user.role);

  // Honour the page the buyer was heading for; otherwise their home locale.
  return NextResponse.redirect(new URL(next ?? `/${user.preferredLocale}`, url));
}
