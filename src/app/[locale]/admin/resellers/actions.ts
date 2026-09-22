"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import {
  reviewResellerApplicationSchema,
  tierSchema,
  setTierPriceOverrideSchema,
  deleteTierPriceOverrideSchema,
} from "@/lib/admin/validation";
import { refreshComputedPrices } from "@/lib/pricing";

function adminError(msg: string) {
  return { error: msg } as const;
}

/**
 * 1-Click Approve or Reject a user's reseller application.
 */
export async function reviewResellerApplication(formData: FormData) {
  const session = await requireAdmin();
  const parsed = reviewResellerApplicationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return adminError("BAD_REQUEST");

  const { userId, action, tierId, note } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return adminError("USER_NOT_FOUND");

  if (action === "approve") {
    // If a tierId is specified, verify it exists; else assign the first tier
    let targetTierId = tierId;
    if (targetTierId) {
      const tier = await prisma.resellerTier.findUnique({ where: { id: targetTierId } });
      if (!tier) return adminError("TIER_NOT_FOUND");
    } else {
      const defaultTier = await prisma.resellerTier.findFirst({ orderBy: { discountPercent: "asc" } });
      targetTierId = defaultTier?.id;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        role: "RESELLER",
        tierId: targetTierId ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: session.userId,
        action: "RESELLER_APPLICATION_APPROVED",
        entity: "User",
        entityId: userId,
        detail: {
          assignedTierId: targetTierId,
          note,
        } as never,
      },
    });
  } else {
    // Rejected: revert to regular CUSTOMER
    await prisma.user.update({
      where: { id: userId },
      data: {
        role: "CUSTOMER",
        tierId: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: session.userId,
        action: "RESELLER_APPLICATION_REJECTED",
        entity: "User",
        entityId: userId,
        detail: { note } as never,
      },
    });
  }

  revalidatePath("/admin/resellers");
  revalidatePath("/admin/users");
  return { ok: true as const };
}

/**
 * Create a new Reseller Tier (e.g. Silver, Gold).
 */
export async function createResellerTier(formData: FormData) {
  const session = await requireAdmin();
  const parsed = tierSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return adminError("BAD_REQUEST");

  const { name, discountPercent, minDepositMinor } = parsed.data;

  const existing = await prisma.resellerTier.findUnique({ where: { name } });
  if (existing) return adminError("TIER_NAME_TAKEN");

  const tier = await prisma.resellerTier.create({
    data: {
      name,
      discountPercent,
      minDepositMinor,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "RESELLER_TIER_CREATED",
      entity: "ResellerTier",
      entityId: tier.id,
      detail: { name, discountPercent, minDepositMinor } as never,
    },
  });

  revalidatePath("/admin/resellers");
  return { ok: true as const, tierId: tier.id };
}

/**
 * Update an existing Reseller Tier's discount or minimum deposit.
 */
export async function updateResellerTier(formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const tierId = String(raw.tierId ?? "");
  if (!tierId) return adminError("BAD_REQUEST");

  const parsed = tierSchema.safeParse(raw);
  if (!parsed.success) return adminError("BAD_REQUEST");

  const { name, discountPercent, minDepositMinor } = parsed.data;

  const existing = await prisma.resellerTier.findUnique({ where: { id: tierId } });
  if (!existing) return adminError("TIER_NOT_FOUND");

  await prisma.resellerTier.update({
    where: { id: tierId },
    data: {
      name,
      discountPercent,
      minDepositMinor,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "RESELLER_TIER_UPDATED",
      entity: "ResellerTier",
      entityId: tierId,
      detail: { name, discountPercent, minDepositMinor } as never,
    },
  });

  revalidatePath("/admin/resellers");
  return { ok: true as const };
}

/**
 * Delete a Reseller Tier (fails safely if active members exist).
 */
export async function deleteResellerTier(formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const tierId = String(raw.tierId ?? "");
  if (!tierId) return adminError("BAD_REQUEST");

  const count = await prisma.user.count({ where: { tierId } });
  if (count > 0) return adminError("TIER_HAS_ACTIVE_MEMBERS");

  await prisma.resellerTier.delete({ where: { id: tierId } });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "RESELLER_TIER_DELETED",
      entity: "ResellerTier",
      entityId: tierId,
    },
  });

  revalidatePath("/admin/resellers");
  return { ok: true as const };
}

/**
 * Set a wholesale price override for an Offer x ResellerTier pair, bypassing percentage formulas.
 */
export async function setTierPriceOverride(formData: FormData) {
  const session = await requireAdmin();
  const parsed = setTierPriceOverrideSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return adminError("BAD_REQUEST");

  const { offerId, tierId, priceMinor } = parsed.data;

  const [offer, tier] = await Promise.all([
    prisma.offer.findUnique({ where: { id: offerId } }),
    prisma.resellerTier.findUnique({ where: { id: tierId } }),
  ]);
  if (!offer || !tier) return adminError("NOT_FOUND");

  await prisma.offerTierPriceOverride.upsert({
    where: {
      offerId_tierId: { offerId, tierId },
    },
    update: { priceMinor: BigInt(priceMinor) },
    create: {
      offerId,
      tierId,
      priceMinor: BigInt(priceMinor),
    },
  });

  // Recompute prices cache for this offer across all tiers
  await refreshComputedPrices(offerId);

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "TIER_PRICE_OVERRIDE_SET",
      entity: "OfferTierPriceOverride",
      entityId: `${offerId}:${tierId}`,
      detail: {
        offerId,
        tierId,
        tierName: tier.name,
        priceMinor,
      } as never,
    },
  });

  revalidatePath("/admin/resellers");
  return { ok: true as const };
}

/**
 * Remove a wholesale price override, restoring the tier's formula discount.
 */
export async function deleteTierPriceOverride(formData: FormData) {
  const session = await requireAdmin();
  const parsed = deleteTierPriceOverrideSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return adminError("BAD_REQUEST");

  const { offerId, tierId } = parsed.data;

  await prisma.offerTierPriceOverride.deleteMany({
    where: { offerId, tierId },
  });

  await refreshComputedPrices(offerId);

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "TIER_PRICE_OVERRIDE_DELETED",
      entity: "OfferTierPriceOverride",
      entityId: `${offerId}:${tierId}`,
      detail: { offerId, tierId } as never,
    },
  });

  revalidatePath("/admin/resellers");
  return { ok: true as const };
}
