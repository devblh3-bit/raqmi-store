"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import {
  adjustBalanceSchema,
  updateUserRoleTierSchema,
} from "@/lib/admin/validation";
import { creditWallet, debitWallet, InsufficientFundsError } from "@/lib/wallet";

function adminError(msg: string) {
  return { error: msg } as const;
}

/**
 * Manually credit or debit a user's wallet with mandatory audit justification.
 */
export async function adjustUserBalance(formData: FormData) {
  const session = await requireAdmin();
  const parsed = adjustBalanceSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return adminError("BAD_REQUEST");

  const { userId, direction, amountMinor, reason } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wallet: true },
  });
  if (!user) return adminError("USER_NOT_FOUND");

  try {
    let txn;
    if (direction === "credit") {
      txn = await creditWallet({
        userId,
        amountMinor,
        type: "ADJUSTMENT",
        note: reason,
      });
    } else {
      txn = await debitWallet({
        userId,
        amountMinor,
        type: "ADJUSTMENT",
        note: reason,
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: session.userId,
        action: "USER_BALANCE_ADJUSTED",
        entity: "User",
        entityId: userId,
        detail: {
          direction,
          amountMinor,
          balanceAfterMinor: txn.balanceAfterMinor.toString(),
          reason,
        } as never,
      },
    });

    revalidatePath("/admin/users");
    return { ok: true as const, balanceAfterMinor: txn.balanceAfterMinor.toString() };
  } catch (e) {
    if (e instanceof InsufficientFundsError) {
      return adminError("INSUFFICIENT_FUNDS");
    }
    throw e;
  }
}

/**
 * Update user role (CUSTOMER, RESELLER_APPLICANT, RESELLER, ADMIN) and optionally assign a reseller tier.
 */
export async function updateUserRoleAndTier(formData: FormData) {
  const session = await requireAdmin();
  const parsed = updateUserRoleTierSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return adminError("BAD_REQUEST");

  const { userId, role, tierId } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return adminError("USER_NOT_FOUND");

  // If tierId is supplied, verify it exists
  if (tierId) {
    const tier = await prisma.resellerTier.findUnique({ where: { id: tierId } });
    if (!tier) return adminError("TIER_NOT_FOUND");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      role,
      tierId: tierId || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "USER_ROLE_UPDATED",
      entity: "User",
      entityId: userId,
      detail: {
        previousRole: user.role,
        previousTierId: user.tierId,
        newRole: role,
        newTierId: tierId || null,
      } as never,
    },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/resellers");
  return { ok: true as const };
}
