"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdapter } from "@/lib/providers";

const thresholdSchema = z.object({
  providerId: z.string().min(1),
  threshold: z.string().trim().max(20),
});

export async function updateLowBalanceThreshold(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const parsed = thresholdSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;

  const raw = parsed.data.threshold.trim();
  const value = raw === "" ? null : BigInt(raw);
  if (value !== null && value < 0n) return;

  await prisma.provider.update({
    where: { id: parsed.data.providerId },
    data: { lowBalanceThresholdMinor: value },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "PROVIDER_THRESHOLD_UPDATED",
      entity: "Provider",
      entityId: parsed.data.providerId,
      detail: { lowBalanceThresholdMinor: value?.toString() ?? null } as never,
    },
  });

  revalidatePath("/admin/sync");
}

export async function toggleProviderActive(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const providerId = String(formData.get("providerId") ?? "");
  const provider = await prisma.provider.findUnique({ where: { id: providerId } });
  if (!provider) return;

  const next = !provider.isActive;
  await prisma.provider.update({ where: { id: providerId }, data: { isActive: next } });

  if (!next) {
    // Provider was disabled: find all products linked to this provider
    const productsWithOffers = await prisma.product.findMany({
      where: {
        offers: {
          some: {
            links: {
              some: {
                providerOffer: { providerId },
              },
            },
          },
        },
      },
      include: {
        offers: {
          include: {
            links: {
              include: {
                providerOffer: {
                  select: {
                    providerId: true,
                    provider: { select: { isActive: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const productsToDeactivate: string[] = [];
    for (const prod of productsWithOffers) {
      // Check if product has any enabled link to any OTHER active provider
      const hasOtherActiveProvider = prod.offers.some((offer) =>
        offer.links.some(
          (link) =>
            link.isEnabled &&
            link.providerOffer.providerId !== providerId &&
            link.providerOffer.provider.isActive,
        ),
      );
      if (!hasOtherActiveProvider) {
        productsToDeactivate.push(prod.id);
      }
    }

    if (productsToDeactivate.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: productsToDeactivate } },
        data: { isActive: false },
      });
    }
  } else {
    // Provider was enabled: re-activate products linked to this provider
    const productsToActivate = await prisma.product.findMany({
      where: {
        offers: {
          some: {
            links: {
              some: {
                providerOffer: { providerId },
              },
            },
          },
        },
      },
      select: { id: true },
    });

    if (productsToActivate.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: productsToActivate.map((p) => p.id) } },
        data: { isActive: true },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: next ? "PROVIDER_ENABLED" : "PROVIDER_DISABLED",
      entity: "Provider",
      entityId: providerId,
      detail: { code: provider.code } as never,
    },
  });

  revalidatePath("/admin/sync");
  revalidatePath("/admin/catalog");
  revalidatePath("/[locale]/admin/sync", "page");
  revalidatePath("/[locale]/admin/catalog", "page");
}

export async function deleteProductsOfDisabledProvider(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const providerId = String(formData.get("providerId") ?? "");
  const provider = await prisma.provider.findUnique({ where: { id: providerId } });
  if (!provider || provider.isActive) {
    return;
  }

  // Find products whose offers ONLY connect to this provider
  const candidateProducts = await prisma.product.findMany({
    where: {
      offers: {
        some: {
          links: {
            some: {
              providerOffer: { providerId },
            },
          },
        },
      },
    },
    include: {
      offers: {
        include: {
          links: {
            include: {
              providerOffer: { select: { providerId: true } },
            },
          },
        },
      },
    },
  });

  const exclusiveProductIds: string[] = [];
  for (const prod of candidateProducts) {
    const hasOtherProviderLinks = prod.offers.some((offer) =>
      offer.links.some((l) => l.providerOffer.providerId !== providerId),
    );
    if (!hasOtherProviderLinks) {
      exclusiveProductIds.push(prod.id);
    }
  }

  if (exclusiveProductIds.length === 0) {
    return;
  }

  // Check for any customer orders referencing offers on these products
  const productsWithOrders = await prisma.orderItem.findMany({
    where: { offer: { productId: { in: exclusiveProductIds } } },
    select: { offer: { select: { productId: true } } },
  });
  const orderProductIds = new Set(productsWithOrders.map((oi) => oi.offer.productId));

  const safeToDelete = exclusiveProductIds.filter((id) => !orderProductIds.has(id));
  const mustOnlyDeactivate = exclusiveProductIds.filter((id) => orderProductIds.has(id));

  let deletedCount = 0;
  if (safeToDelete.length > 0) {
    await prisma.offerProviderLink.deleteMany({
      where: { offer: { productId: { in: safeToDelete } } },
    });
    await prisma.offer.deleteMany({
      where: { productId: { in: safeToDelete } },
    });
    const res = await prisma.product.deleteMany({
      where: { id: { in: safeToDelete } },
    });
    deletedCount = res.count;
  }

  if (mustOnlyDeactivate.length > 0) {
    await prisma.product.updateMany({
      where: { id: { in: mustOnlyDeactivate } },
      data: { isActive: false },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "PRODUCTS_PURGED_FROM_DISABLED_PROVIDER",
      entity: "Provider",
      entityId: providerId,
      detail: {
        providerCode: provider.code,
        deletedProductCount: deletedCount,
        deactivatedProductCount: mustOnlyDeactivate.length,
      } as never,
    },
  });

  revalidatePath("/admin/sync");
  revalidatePath("/admin/catalog");
  revalidatePath("/[locale]/admin/sync", "page");
  revalidatePath("/[locale]/admin/catalog", "page");
}

export async function refreshProviderBalance(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const providerId = String(formData.get("providerId") ?? "");
  const provider = await prisma.provider.findUnique({ where: { id: providerId } });
  if (!provider) return;

  const adapter = getAdapter(provider.code);
  if (!adapter) return;

  const result = await adapter.getBalance();
  if (!result.ok) {
    const msg = "notSupported" in result ? (result as { message: string }).message : (result as { error: { message: string } }).error.message;
    await prisma.notification.create({
      data: {
        type: "LOW_BALANCE",
        severity: "warning",
        titleEn: `Balance check failed for ${provider.displayName}`,
        bodyEn: msg.slice(0, 500),
        link: "/admin/sync",
      },
    });
    return;
  }

  await prisma.provider.update({
    where: { id: providerId },
    data: {
      balanceMinor: BigInt(result.value.availableMinor),
      balanceCurrency: result.value.currency,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "PROVIDER_BALANCE_REFRESHED",
      entity: "Provider",
      entityId: providerId,
      detail: { availableMinor: result.value.availableMinor, currency: result.value.currency } as never,
    },
  });

  revalidatePath("/admin/sync");
}
