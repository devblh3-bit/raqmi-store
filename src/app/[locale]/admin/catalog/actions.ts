"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { dedupeKeyForOffer } from "@/lib/catalog/dedupe";
import { Prisma } from "@prisma/client";
import {
  productSchema,
  deriveSlug,
  attachOfferSchema,
  detachOfferSchema,
  updateOfferLabelsSchema,
  createOfferFromProviderSchema,
  attachBackupProviderSchema,
  updateOfferFullSchema,
  toggleLinkSchema,
  deleteLinkSchema,
  reorderLinkSchema,
} from "@/lib/admin/validation";

import { autoTranslateStoreText, cleanProviderDescription } from "@/lib/catalog/translation";

function adminError(msg: string) {
  return { error: msg } as const;
}

export async function createProduct(formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  // checkboxes come as "on" or absent
  const parsed = productSchema.safeParse({
    nameEn: raw.nameEn,
    nameAr: raw.nameAr || undefined,
    nameFr: raw.nameFr || undefined,
    slug: raw.slug || undefined,
    categoryId: raw.categoryId,
    descriptionEn: raw.descriptionEn || undefined,
    descriptionAr: raw.descriptionAr || undefined,
    descriptionFr: raw.descriptionFr || undefined,
    shortEn: raw.shortEn || undefined,
    shortAr: raw.shortAr || undefined,
    shortFr: raw.shortFr || undefined,
    isActive: raw.isActive === "on" || raw.isActive === "true",
    isFeatured: raw.isFeatured === "on",
    isNew: raw.isNew === "on",
    contentLocked: raw.contentLocked === "on",
    sortOrder: raw.sortOrder || undefined,
  });
  if (!parsed.success) return adminError("BAD_REQUEST");

  const auto = autoTranslateStoreText(parsed.data.nameEn);
  const nameAr = parsed.data.nameAr || auto.ar || parsed.data.nameEn;
  const nameFr = parsed.data.nameFr || auto.fr || parsed.data.nameEn;

  const slug = deriveSlug(parsed.data.nameEn, parsed.data.slug);
  // ensure unique slug
  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) return adminError("SLUG_TAKEN");

  const product = await prisma.product.create({
    data: {
      slug,
      nameEn: parsed.data.nameEn,
      nameAr,
      nameFr,
      categoryId: parsed.data.categoryId,
      descriptionEn: parsed.data.descriptionEn ?? "",
      descriptionAr: parsed.data.descriptionAr || auto.ar || "",
      descriptionFr: parsed.data.descriptionFr || auto.fr || "",
      shortEn: parsed.data.shortEn ?? "",
      shortAr: parsed.data.shortAr ?? "",
      shortFr: parsed.data.shortFr ?? "",
      isActive: parsed.data.isActive ?? true,
      isFeatured: parsed.data.isFeatured ?? false,
      isNew: parsed.data.isNew ?? false,
      contentLocked: parsed.data.contentLocked ?? false,
      sortOrder: parsed.data.sortOrder ?? 0,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "PRODUCT_CREATED",
      entity: "Product",
      entityId: product.id,
      detail: { slug },
    },
  });

  revalidatePath("/admin/catalog");
  return { ok: true as const, id: product.id };
}

export async function updateProduct(productId: string, formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = productSchema.safeParse({
    nameEn: raw.nameEn,
    nameAr: raw.nameAr,
    nameFr: raw.nameFr,
    slug: raw.slug || undefined,
    categoryId: raw.categoryId,
    descriptionEn: raw.descriptionEn || undefined,
    descriptionAr: raw.descriptionAr || undefined,
    descriptionFr: raw.descriptionFr || undefined,
    shortEn: raw.shortEn || undefined,
    shortAr: raw.shortAr || undefined,
    shortFr: raw.shortFr || undefined,
    isActive: raw.isActive === "on" || raw.isActive === "true",
    isFeatured: raw.isFeatured === "on",
    isNew: raw.isNew === "on",
    contentLocked: raw.contentLocked === "on",
    sortOrder: raw.sortOrder || undefined,
  });
  if (!parsed.success) return adminError("BAD_REQUEST");

  const slug = deriveSlug(parsed.data.nameEn, parsed.data.slug);
  const clash = await prisma.product.findFirst({ where: { slug, id: { not: productId } } });
  if (clash) return adminError("SLUG_TAKEN");

  await prisma.product.update({
    where: { id: productId },
    data: {
      slug,
      nameEn: parsed.data.nameEn,
      nameAr: parsed.data.nameAr,
      nameFr: parsed.data.nameFr,
      categoryId: parsed.data.categoryId,
      descriptionEn: parsed.data.descriptionEn ?? "",
      descriptionAr: parsed.data.descriptionAr ?? "",
      descriptionFr: parsed.data.descriptionFr ?? "",
      shortEn: parsed.data.shortEn ?? "",
      shortAr: parsed.data.shortAr ?? "",
      shortFr: parsed.data.shortFr ?? "",
      isActive: parsed.data.isActive ?? true,
      isFeatured: parsed.data.isFeatured ?? false,
      isNew: parsed.data.isNew ?? false,
      contentLocked: parsed.data.contentLocked ?? false,
      sortOrder: parsed.data.sortOrder ?? 0,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "PRODUCT_UPDATED",
      entity: "Product",
      entityId: productId,
      detail: { slug },
    },
  });

  revalidatePath("/admin/catalog");
  revalidatePath(`/admin/catalog/${productId}`);
  return { ok: true as const };
}

export async function attachOfferToProduct(formData: FormData) {
  const session = await requireAdmin();
  const parsed = attachOfferSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return adminError("BAD_REQUEST");

  const { offerId, productId } = parsed.data;
  const [offer, product] = await Promise.all([
    prisma.offer.findUnique({ where: { id: offerId } }),
    prisma.product.findUnique({ where: { id: productId } }),
  ]);
  if (!offer || !product) return adminError("NOT_FOUND");

  const dedupeKey = dedupeKeyForOffer({ labelEn: offer.labelEn, productSlug: product.slug });

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${offerId}))`;
    await tx.offer.update({
      where: { id: offerId },
      data: { productId, dedupeKey, productPinned: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: "OFFER_PINNED",
        entity: "Offer",
        entityId: offerId,
        detail: { productId, dedupeKey, fromProductId: offer.productId } as never,
      },
    });
  });

  revalidatePath(`/admin/catalog/${productId}`);
  revalidatePath(`/admin/catalog/${productId}/offers`);
  return { ok: true as const };
}

export async function detachOffer(formData: FormData) {
  const session = await requireAdmin();
  const parsed = detachOfferSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return adminError("BAD_REQUEST");

  const offer = await prisma.offer.findUnique({ where: { id: parsed.data.offerId } });
  if (!offer) return adminError("NOT_FOUND");

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${offer.id}))`;
    await tx.offer.update({
      where: { id: offer.id },
      data: { productPinned: false },
    });
    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: "OFFER_UNPINNED",
        entity: "Offer",
        entityId: offer.id,
        detail: { productId: offer.productId } as never,
      },
    });
  });

  revalidatePath(`/admin/catalog/${offer.productId}`);
  return { ok: true as const };
}

export async function updateOfferLabels(formData: FormData) {
  const session = await requireAdmin();
  const parsed = updateOfferLabelsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return adminError("BAD_REQUEST");

  const offer = await prisma.offer.findUnique({ where: { id: parsed.data.offerId } });
  if (!offer) return adminError("NOT_FOUND");

  await prisma.offer.update({
    where: { id: offer.id },
    data: {
      labelEn: parsed.data.labelEn,
      labelAr: parsed.data.labelAr,
      labelFr: parsed.data.labelFr,
      rulesEn: parsed.data.rulesEn ?? "",
      rulesAr: parsed.data.rulesAr ?? "",
      rulesFr: parsed.data.rulesFr ?? "",
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "OFFER_LABELS_UPDATED",
      entity: "Offer",
      entityId: offer.id,
      detail: { labelEn: parsed.data.labelEn } as never,
    },
  });

  revalidatePath(`/admin/catalog/${offer.productId}`);
  return { ok: true as const };
}

export async function createOfferFromProvider(formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = createOfferFromProviderSchema.safeParse(raw);
  if (!parsed.success) return adminError("BAD_REQUEST");

  const {
    productId,
    providerOfferId,
    labelEn,
    labelAr,
    labelFr,
    rulesEn,
    rulesAr,
    rulesFr,
    markupPercent,
    compareAtMinor,
    badge,
  } = parsed.data;

  const [product, providerOffer] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId } }),
    prisma.providerOffer.findUnique({ where: { id: providerOfferId } }),
  ]);

  if (!product || !providerOffer) return adminError("NOT_FOUND");

  const dedupeKey = dedupeKeyForOffer({ labelEn, productSlug: product.slug });

  const rawDesc = cleanProviderDescription(
    providerOffer.rawDescriptionEn ||
    providerOffer.rawDescription ||
    providerOffer.rawWarranty ||
    ""
  );
  const descAuto = autoTranslateStoreText(rawDesc);

  const finalRulesEn = (rulesEn?.trim() || rawDesc).trim();
  const finalRulesAr = (rulesAr?.trim() || descAuto.ar || finalRulesEn).trim();
  const finalRulesFr = (rulesFr?.trim() || descAuto.fr || finalRulesEn).trim();

  const result = await prisma.$transaction(async (tx) => {
    const offer = await tx.offer.create({
      data: {
        productId,
        labelEn,
        labelAr,
        labelFr,
        rulesEn: finalRulesEn,
        rulesAr: finalRulesAr,
        rulesFr: finalRulesFr,
        markupPercent: new Prisma.Decimal(markupPercent),
        compareAtMinor: compareAtMinor != null ? BigInt(compareAtMinor) : null,
        badge: badge || null,
        productPinned: true,
        dedupeKey,
        isActive: true,
      },
    });

    const link = await tx.offerProviderLink.create({
      data: {
        offerId: offer.id,
        providerOfferId,
        priority: 1,
        isEnabled: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: "OFFER_CREATED_FROM_PROVIDER",
        entity: "Offer",
        entityId: offer.id,
        detail: {
          productId,
          providerOfferId,
          labelEn,
          markupPercent,
          linkId: link.id,
        } as never,
      },
    });

    return offer;
  });

  revalidatePath(`/admin/catalog/${productId}`);
  revalidatePath(`/admin/catalog/${productId}/offers`);
  revalidatePath(`/products/${product.slug}`);
  return { ok: true as const, offerId: result.id };
}

export async function attachBackupProvider(formData: FormData) {
  const session = await requireAdmin();
  const parsed = attachBackupProviderSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return adminError("BAD_REQUEST");

  const { offerId, providerOfferId } = parsed.data;

  const [offer, providerOffer] = await Promise.all([
    prisma.offer.findUnique({
      where: { id: offerId },
      include: { links: { orderBy: { priority: "desc" }, take: 1 } },
    }),
    prisma.providerOffer.findUnique({ where: { id: providerOfferId } }),
  ]);

  if (!offer || !providerOffer) return adminError("NOT_FOUND");

  const existing = await prisma.offerProviderLink.findUnique({
    where: {
      offerId_providerOfferId: {
        offerId,
        providerOfferId,
      },
    },
  });

  if (existing) return adminError("ALREADY_LINKED");

  const highestPriority = offer.links[0]?.priority ?? 0;

  const link = await prisma.$transaction(async (tx) => {
    const created = await tx.offerProviderLink.create({
      data: {
        offerId,
        providerOfferId,
        priority: highestPriority + 1,
        isEnabled: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: "BACKUP_PROVIDER_ATTACHED",
        entity: "OfferProviderLink",
        entityId: created.id,
        detail: {
          offerId,
          providerOfferId,
          priority: created.priority,
        } as never,
      },
    });

    if (!offer.rulesEn && (providerOffer.rawDescription || providerOffer.rawDescriptionEn || providerOffer.rawWarranty)) {
      const poDesc = cleanProviderDescription(
        providerOffer.rawDescriptionEn || providerOffer.rawDescription || providerOffer.rawWarranty || ""
      );
      if (poDesc) {
        const poAuto = autoTranslateStoreText(poDesc);
        await tx.offer.update({
          where: { id: offerId },
          data: {
            rulesEn: poDesc,
            rulesAr: poAuto.ar || poDesc,
            rulesFr: poAuto.fr || poDesc,
          },
        });
      }
    }

    return created;
  });

  revalidatePath(`/admin/catalog/${offer.productId}/offers`);
  return { ok: true as const, linkId: link.id };
}

export async function updateOfferFull(formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = updateOfferFullSchema.safeParse(raw);
  if (!parsed.success) return adminError("BAD_REQUEST");

  const {
    offerId,
    labelEn,
    labelAr,
    labelFr,
    rulesEn,
    rulesAr,
    rulesFr,
    markupPercent,
    compareAtMinor,
    badge,
  } = parsed.data;

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: { product: { select: { slug: true } } },
  });
  if (!offer) return adminError("NOT_FOUND");

  const dedupeKey = dedupeKeyForOffer({ labelEn, productSlug: offer.product.slug });

  await prisma.$transaction(async (tx) => {
    await tx.offer.update({
      where: { id: offerId },
      data: {
        labelEn,
        labelAr,
        labelFr,
        rulesEn: rulesEn || "",
        rulesAr: rulesAr || "",
        rulesFr: rulesFr || "",
        markupPercent: new Prisma.Decimal(markupPercent),
        compareAtMinor: compareAtMinor != null ? BigInt(compareAtMinor) : null,
        badge: badge || null,
        dedupeKey,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: "OFFER_UPDATED",
        entity: "Offer",
        entityId: offer.id,
        detail: { labelEn, markupPercent, badge } as never,
      },
    });
  });

  revalidatePath(`/admin/catalog/${offer.productId}`);
  revalidatePath(`/admin/catalog/${offer.productId}/offers`);
  revalidatePath(`/products/${offer.product.slug}`);
  return { ok: true as const };
}

export async function toggleLink(formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = toggleLinkSchema.safeParse({
    linkId: raw.linkId,
    isEnabled: raw.isEnabled === "true" || raw.isEnabled === "on",
  });
  if (!parsed.success) return adminError("BAD_REQUEST");

  const link = await prisma.offerProviderLink.findUnique({
    where: { id: parsed.data.linkId },
    include: { offer: { select: { productId: true } } },
  });
  if (!link) return adminError("NOT_FOUND");

  await prisma.offerProviderLink.update({
    where: { id: link.id },
    data: { isEnabled: parsed.data.isEnabled },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "LINK_TOGGLED",
      entity: "OfferProviderLink",
      entityId: link.id,
      detail: { isEnabled: parsed.data.isEnabled } as never,
    },
  });

  revalidatePath(`/admin/catalog/${link.offer.productId}/offers`);
  return { ok: true as const };
}

export async function deleteLink(formData: FormData) {
  const session = await requireAdmin();
  const parsed = deleteLinkSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return adminError("BAD_REQUEST");

  const link = await prisma.offerProviderLink.findUnique({
    where: { id: parsed.data.linkId },
    include: { offer: { select: { productId: true } } },
  });
  if (!link) return adminError("NOT_FOUND");

  await prisma.offerProviderLink.delete({
    where: { id: link.id },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "LINK_DELETED",
      entity: "OfferProviderLink",
      entityId: link.id,
      detail: { offerId: link.offerId, providerOfferId: link.providerOfferId } as never,
    },
  });

  revalidatePath(`/admin/catalog/${link.offer.productId}/offers`);
  return { ok: true as const };
}

export async function reorderLink(formData: FormData) {
  await requireAdmin();
  const parsed = reorderLinkSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return adminError("BAD_REQUEST");

  const { linkId, direction } = parsed.data;
  const link = await prisma.offerProviderLink.findUnique({
    where: { id: linkId },
    include: {
      offer: {
        include: {
          links: { orderBy: { priority: "asc" } },
        },
      },
    },
  });
  if (!link) return adminError("NOT_FOUND");

  const links = link.offer.links;
  const currentIndex = links.findIndex((l) => l.id === linkId);
  if (currentIndex === -1) return adminError("NOT_FOUND");

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= links.length) {
    // Already at the boundary
    return { ok: true as const };
  }

  const targetLink = links[targetIndex];

  await prisma.$transaction([
    prisma.offerProviderLink.update({
      where: { id: link.id },
      data: { priority: targetLink.priority },
    }),
    prisma.offerProviderLink.update({
      where: { id: targetLink.id },
      data: { priority: link.priority },
    }),
  ]);

  revalidatePath(`/admin/catalog/${link.offer.productId}/offers`);
  return { ok: true as const };
}

export async function deleteOffer(formData: FormData) {
  const session = await requireAdmin();
  const offerId = String(formData.get("offerId") ?? "");
  if (!offerId) return adminError("BAD_REQUEST");

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { id: true, productId: true, labelEn: true },
  });
  if (!offer) return adminError("NOT_FOUND");

  // Check if any customer order items reference this offer
  const ordersCount = await prisma.orderItem.count({
    where: { offerId },
  });

  if (ordersCount > 0) {
    // Preserve DB integrity for historical customer orders.
    // Deactivate and archive the variant so it is immediately removed from the customer storefront and cart.
    await prisma.$transaction(async (tx) => {
      await tx.offerProviderLink.deleteMany({ where: { offerId } });
      await tx.offerTierPriceOverride.deleteMany({ where: { offerId } });
      await tx.offerComputedPrice.deleteMany({ where: { offerId } });
      await tx.offer.update({
        where: { id: offerId },
        data: {
          isActive: false,
          productPinned: false,
          sortOrder: 9999,
          dedupeKey: null,
          labelEn: offer.labelEn.startsWith("[Archived]")
            ? offer.labelEn
            : `[Archived] ${offer.labelEn}`,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: "OFFER_ARCHIVED",
          entity: "Offer",
          entityId: offer.id,
          detail: {
            productId: offer.productId,
            reason: "Preserved for historical customer orders",
            ordersCount,
          } as never,
        },
      });
    });

    revalidatePath(`/admin/catalog/${offer.productId}`);
    revalidatePath(`/admin/catalog/${offer.productId}/offers`);
    revalidatePath("/admin/catalog");
    return {
      ok: true as const,
      archived: true,
      message: `Variant has ${ordersCount} past order(s). It has been archived and removed from the storefront.`,
    };
  }

  // Safe to delete completely when no orders reference it
  await prisma.offerProviderLink.deleteMany({ where: { offerId } });
  await prisma.offerTierPriceOverride.deleteMany({ where: { offerId } });
  await prisma.offerComputedPrice.deleteMany({ where: { offerId } });
  await prisma.offer.delete({
    where: { id: offerId },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "OFFER_DELETED",
      entity: "Offer",
      entityId: offer.id,
      detail: { productId: offer.productId } as never,
    },
  });

  revalidatePath(`/admin/catalog/${offer.productId}`);
  revalidatePath(`/admin/catalog/${offer.productId}/offers`);
  revalidatePath("/admin/catalog");
  return { ok: true as const };
}

export async function reorderOffer(formData: FormData) {
  await requireAdmin();
  const offerId = String(formData.get("offerId") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!offerId || (direction !== "up" && direction !== "down")) {
    return adminError("BAD_REQUEST");
  }

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: {
      product: {
        include: {
          offers: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });
  if (!offer) return adminError("NOT_FOUND");

  const offers = offer.product.offers;
  const currentIndex = offers.findIndex((o) => o.id === offerId);
  if (currentIndex === -1) return adminError("NOT_FOUND");

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= offers.length) {
    return { ok: true as const };
  }

  const targetOffer = offers[targetIndex];

  await prisma.$transaction([
    prisma.offer.update({
      where: { id: offer.id },
      data: { sortOrder: targetIndex },
    }),
    prisma.offer.update({
      where: { id: targetOffer.id },
      data: { sortOrder: currentIndex },
    }),
  ]);

  revalidatePath(`/admin/catalog/${offer.productId}`);
  revalidatePath(`/admin/catalog/${offer.productId}/offers`);
  revalidatePath(`/products/${offer.product.slug}`);
  return { ok: true as const };
}

export async function toggleProductActive(productId: string) {
  const session = await requireAdmin();
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, isActive: true, nameEn: true, slug: true },
  });
  if (!product) return adminError("NOT_FOUND");

  const nextActive = !product.isActive;
  await prisma.product.update({
    where: { id: productId },
    data: { isActive: nextActive },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "PRODUCT_UPDATED",
      entity: "Product",
      entityId: productId,
      detail: { field: "isActive", from: product.isActive, to: nextActive, slug: product.slug } as never,
    },
  });

  revalidatePath("/admin/catalog");
  revalidatePath(`/products/${product.slug}`);
  return { ok: true as const, isActive: nextActive };
}

export async function toggleProductFeatured(productId: string) {
  const session = await requireAdmin();
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, isFeatured: true, slug: true },
  });
  if (!product) return adminError("NOT_FOUND");

  const nextFeatured = !product.isFeatured;
  await prisma.product.update({
    where: { id: productId },
    data: { isFeatured: nextFeatured },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "PRODUCT_UPDATED",
      entity: "Product",
      entityId: productId,
      detail: { field: "isFeatured", from: product.isFeatured, to: nextFeatured, slug: product.slug } as never,
    },
  });

  revalidatePath("/admin/catalog");
  return { ok: true as const, isFeatured: nextFeatured };
}

export async function bulkUpdateProductStatus(productIds: string[], isActive: boolean) {
  const session = await requireAdmin();
  if (!productIds || productIds.length === 0) return adminError("BAD_REQUEST");

  await prisma.product.updateMany({
    where: { id: { in: productIds } },
    data: { isActive },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "BULK_PRODUCT_STATUS_UPDATED",
      entity: "Product",
      entityId: "bulk",
      detail: { count: productIds.length, isActive, productIds } as never,
    },
  });

  revalidatePath("/admin/catalog");
  return { ok: true as const, count: productIds.length };
}

export async function bulkUpdateProductCategory(productIds: string[], categoryId: string) {
  const session = await requireAdmin();
  if (!productIds || productIds.length === 0 || !categoryId) return adminError("BAD_REQUEST");

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) return adminError("NOT_FOUND");

  await prisma.product.updateMany({
    where: { id: { in: productIds } },
    data: { categoryId },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "BULK_PRODUCT_CATEGORY_UPDATED",
      entity: "Product",
      entityId: "bulk",
      detail: { count: productIds.length, categoryId, productIds } as never,
    },
  });

  revalidatePath("/admin/catalog");
  return { ok: true as const, count: productIds.length };
}

export async function bulkDeleteProducts(productIds: string[]) {
  const session = await requireAdmin();
  if (!productIds || productIds.length === 0) return adminError("BAD_REQUEST");

  // Identify products whose offers have past orders
  const productsWithOrders = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      offers: { some: { orderItems: { some: {} } } },
    },
    select: { id: true },
  });

  const withOrdersIds = new Set(productsWithOrders.map((p) => p.id));
  const safeToDeleteIds = productIds.filter((id) => !withOrdersIds.has(id));

  await prisma.$transaction(async (tx) => {
    // For products with past orders: deactivate them & their offers instead of crashing
    if (withOrdersIds.size > 0) {
      await tx.product.updateMany({
        where: { id: { in: Array.from(withOrdersIds) } },
        data: { isActive: false },
      });
      await tx.offer.updateMany({
        where: { productId: { in: Array.from(withOrdersIds) } },
        data: { isActive: false, productPinned: false },
      });
    }

    // For products with no orders: hard delete
    if (safeToDeleteIds.length > 0) {
      await tx.offerProviderLink.deleteMany({
        where: { offer: { productId: { in: safeToDeleteIds } } },
      });
      await tx.offerTierPriceOverride.deleteMany({
        where: { offer: { productId: { in: safeToDeleteIds } } },
      });
      await tx.offerComputedPrice.deleteMany({
        where: { offer: { productId: { in: safeToDeleteIds } } },
      });
      await tx.offer.deleteMany({
        where: { productId: { in: safeToDeleteIds } },
      });
      await tx.product.deleteMany({
        where: { id: { in: safeToDeleteIds } },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: "BULK_PRODUCTS_DELETED",
        entity: "Product",
        entityId: "bulk",
        detail: {
          count: productIds.length,
          hardDeleted: safeToDeleteIds.length,
          archived: withOrdersIds.size,
          productIds,
        } as never,
      },
    });
  });

  revalidatePath("/admin/catalog");
  return {
    ok: true as const,
    count: productIds.length,
    archived: withOrdersIds.size,
  };
}

export async function createProductFromProviderOffer(
  providerOfferId: string,
  categoryId?: string,
  markupPercent: number = 15
) {
  const session = await requireAdmin();
  const providerOffer = await prisma.providerOffer.findUnique({
    where: { id: providerOfferId },
    include: { provider: true },
  });
  if (!providerOffer) return adminError("NOT_FOUND");

  // Determine category
  let targetCategoryId = categoryId;
  if (!targetCategoryId) {
    const firstCategory = await prisma.category.findFirst({
      orderBy: { sortOrder: "asc" },
    });
    if (!firstCategory) return adminError("NO_CATEGORIES");
    targetCategoryId = firstCategory.id;
  }

  const rawTitle = (providerOffer.rawNameEn || providerOffer.rawName).trim();
  const auto = autoTranslateStoreText(rawTitle);

  let slug = deriveSlug(rawTitle);
  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now().toString().slice(-4)}`;
  }

  const dedupeKey = dedupeKeyForOffer({ labelEn: rawTitle, productSlug: slug });

  const rawDesc = cleanProviderDescription(
    providerOffer.rawDescriptionEn ||
    providerOffer.rawDescription ||
    providerOffer.rawWarranty ||
    ""
  );
  const descAuto = autoTranslateStoreText(rawDesc);

  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        slug,
        nameEn: rawTitle,
        nameAr: auto.ar || rawTitle,
        nameFr: auto.fr || rawTitle,
        categoryId: targetCategoryId!,
        descriptionEn: rawDesc || "",
        descriptionAr: descAuto.ar || "",
        descriptionFr: descAuto.fr || "",
        shortEn: "",
        shortAr: "",
        shortFr: "",
        isActive: true,
        isFeatured: false,
        isNew: true,
        sortOrder: 0,
      },
    });

    const offer = await tx.offer.create({
      data: {
        productId: product.id,
        labelEn: rawTitle,
        labelAr: auto.ar || rawTitle,
        labelFr: auto.fr || rawTitle,
        rulesEn: rawDesc,
        rulesAr: descAuto.ar || rawDesc,
        rulesFr: descAuto.fr || rawDesc,
        markupPercent: new Prisma.Decimal(markupPercent),
        productPinned: true,
        dedupeKey,
        isActive: true,
      },
    });

    await tx.offerProviderLink.create({
      data: {
        offerId: offer.id,
        providerOfferId,
        priority: 1,
        isEnabled: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: "PRODUCT_CREATED_FROM_PROVIDER",
        entity: "Product",
        entityId: product.id,
        detail: { slug, providerOfferId, offerId: offer.id } as never,
      },
    });

    return { product, offer };
  });

  revalidatePath("/admin/catalog");
  return { ok: true as const, productId: result.product.id, offerId: result.offer.id, slug };
}

export async function linkProviderOfferToExistingProduct(
  productId: string,
  providerOfferId: string,
  labelEn?: string,
  markupPercent: number = 15,
  rulesEn?: string,
  rulesAr?: string,
  rulesFr?: string
) {
  const session = await requireAdmin();
  const [product, providerOffer] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId } }),
    prisma.providerOffer.findUnique({ where: { id: providerOfferId } }),
  ]);

  if (!product || !providerOffer) return adminError("NOT_FOUND");

  const title = (labelEn?.trim() || providerOffer.rawNameEn || providerOffer.rawName).trim();
  const auto = autoTranslateStoreText(title);
  const dedupeKey = dedupeKeyForOffer({ labelEn: title, productSlug: product.slug });

  const rawDesc = cleanProviderDescription(
    providerOffer.rawDescriptionEn ||
    providerOffer.rawDescription ||
    providerOffer.rawWarranty ||
    ""
  );
  const descAuto = autoTranslateStoreText(rawDesc);

  const finalRulesEn = (rulesEn?.trim() || rawDesc).trim();
  const finalRulesAr = (rulesAr?.trim() || descAuto.ar || finalRulesEn).trim();
  const finalRulesFr = (rulesFr?.trim() || descAuto.fr || finalRulesEn).trim();

  const result = await prisma.$transaction(async (tx) => {
    const offer = await tx.offer.create({
      data: {
        productId: product.id,
        labelEn: title,
        labelAr: auto.ar || title,
        labelFr: auto.fr || title,
        rulesEn: finalRulesEn,
        rulesAr: finalRulesAr,
        rulesFr: finalRulesFr,
        markupPercent: new Prisma.Decimal(markupPercent),
        productPinned: true,
        dedupeKey,
        isActive: true,
      },
    });

    await tx.offerProviderLink.create({
      data: {
        offerId: offer.id,
        providerOfferId,
        priority: 1,
        isEnabled: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: "PROVIDER_OFFER_LINKED_TO_PRODUCT",
        entity: "Offer",
        entityId: offer.id,
        detail: { productId: product.id, providerOfferId, labelEn: title } as never,
      },
    });

    return offer;
  });

  revalidatePath("/admin/catalog");
  revalidatePath(`/admin/catalog/${productId}`);
  revalidatePath(`/admin/catalog/${productId}/offers`);
  return { ok: true as const, offerId: result.id };
}

export async function createProductWithInitialOffer(formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData.entries());

  const parsed = productSchema.safeParse({
    nameEn: raw.nameEn,
    nameAr: raw.nameAr || undefined,
    nameFr: raw.nameFr || undefined,
    slug: raw.slug || undefined,
    categoryId: raw.categoryId,
    descriptionEn: raw.descriptionEn || undefined,
    descriptionAr: raw.descriptionAr || undefined,
    descriptionFr: raw.descriptionFr || undefined,
    shortEn: raw.shortEn || undefined,
    shortAr: raw.shortAr || undefined,
    shortFr: raw.shortFr || undefined,
    isActive: raw.isActive === "on" || raw.isActive === "true",
    isFeatured: raw.isFeatured === "on",
    isNew: raw.isNew === "on",
    contentLocked: raw.contentLocked === "on",
    sortOrder: raw.sortOrder || undefined,
  });
  if (!parsed.success) return adminError("BAD_REQUEST");

  const auto = autoTranslateStoreText(parsed.data.nameEn);
  const nameAr = parsed.data.nameAr || auto.ar || parsed.data.nameEn;
  const nameFr = parsed.data.nameFr || auto.fr || parsed.data.nameEn;

  const slug = deriveSlug(parsed.data.nameEn, parsed.data.slug);
  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) return adminError("SLUG_TAKEN");

  const variantLabel = String(raw.variantLabel || "").trim();
  const variantMarkup = raw.variantMarkup ? Number(raw.variantMarkup) : 15;
  const providerOfferId = String(raw.providerOfferId || "").trim();

  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        slug,
        nameEn: parsed.data.nameEn,
        nameAr,
        nameFr,
        categoryId: parsed.data.categoryId,
        descriptionEn: parsed.data.descriptionEn ?? "",
        descriptionAr: parsed.data.descriptionAr || auto.ar || "",
        descriptionFr: parsed.data.descriptionFr || auto.fr || "",
        shortEn: parsed.data.shortEn ?? "",
        shortAr: parsed.data.shortAr ?? "",
        shortFr: parsed.data.shortFr ?? "",
        isActive: parsed.data.isActive ?? true,
        isFeatured: parsed.data.isFeatured ?? false,
        isNew: parsed.data.isNew ?? false,
        contentLocked: parsed.data.contentLocked ?? false,
        sortOrder: parsed.data.sortOrder ?? 0,
      },
    });

    if (variantLabel) {
      const vAuto = autoTranslateStoreText(variantLabel);
      const dedupeKey = dedupeKeyForOffer({ labelEn: variantLabel, productSlug: slug });

      let rulesEn = String(raw.variantRulesEn || "").trim();
      let rulesAr = String(raw.variantRulesAr || "").trim();
      let rulesFr = String(raw.variantRulesFr || "").trim();

      if (providerOfferId && (!rulesEn || !rulesAr || !rulesFr)) {
        const po = await tx.providerOffer.findUnique({ where: { id: providerOfferId } });
        if (po) {
          const poDesc = cleanProviderDescription(
            po.rawDescriptionEn || po.rawDescription || po.rawWarranty || ""
          );
          const poAuto = autoTranslateStoreText(poDesc);
          if (!rulesEn) rulesEn = poDesc;
          if (!rulesAr) rulesAr = poAuto.ar || poDesc;
          if (!rulesFr) rulesFr = poAuto.fr || poDesc;
        }
      }

      const offer = await tx.offer.create({
        data: {
          productId: p.id,
          labelEn: variantLabel,
          labelAr: vAuto.ar || variantLabel,
          labelFr: vAuto.fr || variantLabel,
          rulesEn,
          rulesAr,
          rulesFr,
          markupPercent: new Prisma.Decimal(variantMarkup),
          productPinned: true,
          dedupeKey,
          isActive: true,
        },
      });

      if (providerOfferId) {
        await tx.offerProviderLink.create({
          data: {
            offerId: offer.id,
            providerOfferId,
            priority: 1,
            isEnabled: true,
          },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: "PRODUCT_CREATED",
        entity: "Product",
        entityId: p.id,
        detail: { slug, hasInitialVariant: Boolean(variantLabel) } as never,
      },
    });

    return p;
  });

  revalidatePath("/admin/catalog");
  return { ok: true as const, id: product.id };
}

