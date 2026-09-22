"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { requestDeposit, DepositError, MIN_DEPOSIT_MINOR, MAX_DEPOSIT_MINOR } from "@/lib/deposits";
import { notifyPendingDeposit } from "@/lib/telegram/notify";
import { locales } from "@/i18n";

export type DepositState = { error?: string; ok?: boolean };

// Trust boundary: Server Actions accept direct POSTs, so the session is
// re-read here and the amount is validated server-side regardless of the form.
const schema = z.object({
  // Dollars as typed by the buyer; converted to minor units below.
  amount: z.coerce.number().positive().max(1_000_000),
  method: z.enum(["USDT_BEP20", "USDT_TRC20", "MANUAL_BANK"]),
  txHash: z.string().trim().max(120).optional(),
  proofUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (val) => !val || val.startsWith("/") || val.startsWith("http://") || val.startsWith("https://"),
      "Invalid proof image URL or path",
    )
    .optional(),
  locale: z.enum(locales),
});

export async function submitDeposit(
  _prev: DepositState,
  formData: FormData,
): Promise<DepositState> {
  const parsed = schema.safeParse({
    amount: formData.get("amount"),
    method: formData.get("method"),
    txHash: formData.get("txHash") || undefined,
    proofUrl: formData.get("proofUrl") || undefined,
    locale: formData.get("locale"),
  });
  if (!parsed.success) return { error: "BAD_REQUEST" };
  const { amount, method, txHash, proofUrl, locale } = parsed.data;

  const session = await getSession();
  if (!session) return { error: "UNAUTHENTICATED" };

  // Round to cents before touching money: 19.999 must not become a fraction.
  const amountMinor = BigInt(Math.round(amount * 100));
  if (amountMinor < MIN_DEPOSIT_MINOR || amountMinor > MAX_DEPOSIT_MINOR) {
    return { error: "BAD_AMOUNT" };
  }

  let depositId: string;
  try {
    const deposit = await requestDeposit({
      userId: session.userId,
      amountMinor,
      method,
      txHash,
      proofImageUrl: proofUrl,
      chain: method === "USDT_BEP20" ? "BSC" : method === "USDT_TRC20" ? "TRON" : undefined,
    });
    depositId = deposit.id;
  } catch (e) {
    if (e instanceof DepositError) return { error: e.code };
    console.error("[deposit] request failed:", e);
    return { error: "UNKNOWN" };
  }

  // Alert the admin with Approve/Reject buttons. A failed send must not lose
  // the deposit: it is already recorded and visible in the wallet history.
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });
    await notifyPendingDeposit(
      {
        depositId,
        customerLabel: user?.email ?? session.userId,
        amount: (Number(amountMinor) / 100).toFixed(2),
        currency: "USD",
        method,
        reference: txHash,
        withActions: true,
      },
      // Every deposit needs its own decision, so never collapse these.
      { skipThrottle: true },
    );
  } catch (e) {
    console.error("[deposit] admin alert failed (deposit still recorded):", e);
  }

  revalidatePath(`/${locale}/wallet`);
  return { ok: true };
}
