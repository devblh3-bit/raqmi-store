"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, createSession } from "@/lib/auth/session";
import { issueLoginToken } from "@/lib/auth/magic-link";
import { sendLoginEmail } from "@/lib/auth/email";
import { placeOrder, CheckoutError } from "@/lib/checkout";
import { InsufficientFundsError } from "@/lib/wallet";
import { safeNextPath } from "@/lib/auth/redirect";
import { locales } from "@/i18n";
import { isMaintenanceModeActive } from "@/lib/settings";

export type BuyState = { error?: string; code?: string };

// Server Actions are reachable by direct POST, so everything below is a trust
// boundary: session is re-read server-side and the price is never taken from
// the client — placeOrder re-prices from the DB.
const lineSchema = z.object({
  offerId: z.string().min(20).max(40),
  quantity: z.number().int().min(1).max(100),
  customerInput: z.string().trim().max(500).optional(),
});

const schema = z.object({
  offerId: z.string().min(20).max(40).optional(),
  email: z.string().trim().email().max(254).optional(),
  customerInput: z.string().trim().max(500).optional(),
  lines: z.array(lineSchema).min(1).max(20).optional(),
  locale: z.enum(locales),
  returnTo: z.string().max(512).optional(),
});

export async function buyNow(_prev: BuyState, formData: FormData): Promise<BuyState> {
  const rawLines = formData.get("lines");
  let parsedLines: unknown;
  if (rawLines !== null) {
    if (typeof rawLines !== "string") return { error: "BAD_REQUEST" };
    try {
      parsedLines = JSON.parse(rawLines);
    } catch {
      return { error: "BAD_REQUEST" };
    }
  }

  const parsed = schema.safeParse({
    offerId: formData.get("offerId") || undefined,
    email: formData.get("email") || undefined,
    customerInput: formData.get("customerInput") || undefined,
    lines: parsedLines,
    locale: formData.get("locale"),
    returnTo: formData.get("returnTo") || undefined,
  });
  if (!parsed.success) return { error: "BAD_REQUEST" };
  const { offerId, email: rawEmail, customerInput, lines, locale, returnTo } = parsed.data;
  if (!lines?.length && !offerId) return { error: "BAD_REQUEST" };

  let session = await getSession();

  if (!session) {
    if (!rawEmail) {
      // Send them back to the product they were buying, not to a bare login page.
      // safeNextPath drops anything off-site, so the open-redirect guard applies
      // to the value the browser supplied.
      const back = safeNextPath(returnTo) ?? `/${locale}/products`;
      redirect(`/${locale}/login?next=${encodeURIComponent(back)}`);
    }

    const email = rawEmail.toLowerCase().trim();
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, preferredLocale: locale },
    });

    await createSession(user.id, user.role);

    try {
      const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://raqmi.store";
      const token = await issueLoginToken(user.email);
      const verifyUrl = `${base}/api/auth/verify?token=${token}&next=${encodeURIComponent(`/${locale}/orders`)}`;
      await sendLoginEmail(user.email, verifyUrl);
    } catch (e) {
      console.error("[buy] email send failed:", e);
    }

    session = { userId: user.id, role: user.role, exp: Date.now() + 7 * 24 * 3600 * 1000 };
  }

  if (await isMaintenanceModeActive()) {
    return { error: "MAINTENANCE_MODE" };
  }

  let code: string;
  try {
    const order = await placeOrder({
      userId: session.userId,
      guestEmail: rawEmail ? rawEmail.toLowerCase().trim() : undefined,
      lines: lines ?? [{ offerId: offerId!, quantity: 1, customerInput }],
      locale,
    });
    code = order.code;
  } catch (e) {
    if (e instanceof InsufficientFundsError) return { error: "INSUFFICIENT_FUNDS" };
    if (e instanceof CheckoutError) return { error: e.code };
    // Don't leak internals to the buyer; the server log keeps the detail.
    console.error("[buy] order failed:", e);
    return { error: "UNKNOWN" };
  }

  // Outside the try: redirect() throws by design and must not be caught above.
  redirect(`/${locale}/orders/${code}`);
}
