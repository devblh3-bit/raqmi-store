import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { approveDeposit, rejectDeposit } from "@/lib/deposits";
import { getSystemSettings } from "@/lib/settings";
import { verifyBscUsdtTransaction } from "@/lib/crypto/bsc-verifier";

const idSchema = z.string().min(1).max(50);

export async function approveDepositAction(formData: FormData) {
  const session = await requireAdmin();
  const parsed = idSchema.safeParse(formData.get("depositId"));
  if (!parsed.success) return { error: "BAD_REQUEST" as const };
  const depositId = parsed.data;
  const result = await approveDeposit({ depositId, reviewedById: session.userId });
  if (!result.ok && "code" in result) {
    // DepositError path — surface as typed error
    return { error: result.code as string } as const;
  }
  revalidatePath("/admin/deposits");
  return result;
}

export async function rejectDepositAction(formData: FormData) {
  const session = await requireAdmin();
  const parsed = idSchema.safeParse(formData.get("depositId"));
  if (!parsed.success) return { error: "BAD_REQUEST" as const };
  const depositId = parsed.data;
  const note = String(formData.get("note") ?? "").slice(0, 500) || undefined;
  const result = await rejectDeposit({ depositId, reviewedById: session.userId, reviewNote: note });
  revalidatePath("/admin/deposits");
  return result;
}

export async function verifyDepositOnChainAction(formData: FormData) {
  const session = await requireAdmin();
  const parsed = idSchema.safeParse(formData.get("depositId"));
  if (!parsed.success) return { error: "BAD_REQUEST" as const };
  const depositId = parsed.data;

  const deposit = await prisma.deposit.findUnique({
    where: { id: depositId },
  });
  if (!deposit) return { error: "NOT_FOUND" as const };

  if (deposit.status === "APPROVED") {
    return { ok: true, message: "Deposit is already approved." };
  }

  if (deposit.method !== "USDT_BEP20" || !deposit.txHash) {
    return { error: "NOT_BEP20_TX" as const };
  }

  const settings = await getSystemSettings();
  if (!settings.usdtBep20Address?.trim()) {
    return { error: "STORE_BEP20_ADDRESS_NOT_CONFIGURED" as const };
  }

  const verifyResult = await verifyBscUsdtTransaction({
    txHash: deposit.txHash,
    storeAddress: settings.usdtBep20Address,
    expectedAmountMinor: deposit.amountMinor,
  });

  if (!verifyResult.confirmed) {
    return { error: verifyResult.reason || "ON_CHAIN_VERIFICATION_FAILED" as const };
  }

  const result = await approveDeposit({
    depositId,
    reviewedById: session.userId,
    reviewNote: `NodeReal BSC auto-confirmed: block #${verifyResult.blockNumber}`,
  });

  revalidatePath("/admin/deposits");
  return { ok: true, result };
}

