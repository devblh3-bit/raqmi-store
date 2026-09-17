import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyTelegramLogin } from "@/lib/auth/telegram-login";
import { createSession } from "@/lib/auth/session";
import { defaultLocale } from "@/i18n";

// Telegram Login Widget redirects here (data-auth-url) with the payload as query params.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const data = Object.fromEntries(url.searchParams);
  const fail = NextResponse.redirect(new URL(`/${defaultLocale}/login?error=telegram`, url));

  const payload = verifyTelegramLogin(data);
  if (!payload) return fail;

  const telegramId = BigInt(payload.id);
  const existing = await prisma.user.findFirst({ where: { telegramId } });
  const user =
    existing ??
    (await prisma.user.create({
      // No email from Telegram; synthetic unique placeholder keeps the column's
      // NOT NULL + unique contract. ponytail: prompt for a real email later if needed.
      data: {
        email: `tg${payload.id}@telegram.local`,
        telegramId,
        telegramUsername: payload.username,
      },
    }));
  if (existing && payload.username && existing.telegramUsername !== payload.username) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { telegramUsername: payload.username },
    });
  }
  await createSession(user.id, user.role);
  return NextResponse.redirect(new URL(`/${user.preferredLocale}`, url));
}
