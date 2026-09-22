"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
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
    customerInput: formData.get("customerInput") || undefined,
    lines: parsedLines,
    locale: formData.get("locale"),
    returnTo: formData.get("returnTo") || undefined,
  });
  if (!parsed.success) return { error: "BAD_REQUEST" };
  const { offerId, customerInput, lines, locale, returnTo } = parsed.data;
  if (!lines?.length && !offerId) return { error: "BAD_REQUEST" };

  const session = await getSession();
  if (!session) {
    // Send them back to the product they were buying, not to a bare login page.
    // safeNextPath drops anything off-site, so the open-redirect guard applies
    // to the value the browser supplied.
    const back = safeNextPath(returnTo) ?? `/${locale}/products`;
    redirect(`/${locale}/login?next=${encodeURIComponent(back)}`);
  }

  if (await isMaintenanceModeActive()) {
    return { error: "MAINTENANCE_MODE" };
  }

  let code: string;
  try {
    const order = await placeOrder({
      userId: session.userId,
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
