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

function adminError(msg: string) {
  return { error: msg } as const;
}

export async function createProduct(formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  // checkboxes come as "on" or absent
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
  // ensure unique slug
  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) return adminError("SLUG_TAKEN");

  const product = await prisma.product.create({
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

  const result = await prisma.$transaction(async (tx) => {
    const offer = await tx.offer.create({
      data: {
        productId,
        labelEn,
        labelAr,
        labelFr,
        rulesEn: rulesEn || "",
        rulesAr: rulesAr || "",
        rulesFr: rulesFr || "",
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
    select: { id: true, productId: true },
  });
  if (!offer) return adminError("NOT_FOUND");

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
  return { ok: true as const };
}

