"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { dedupeKeyForOffer } from "@/lib/catalog/dedupe";
import {
  productSchema,
  deriveSlug,
  attachOfferSchema,
  detachOfferSchema,
  updateOfferLabelsSchema,
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
