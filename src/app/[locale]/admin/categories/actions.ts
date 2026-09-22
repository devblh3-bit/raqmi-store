"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import {
  categorySchema,
  updateCategorySchema,
  deriveSlug,
} from "@/lib/admin/validation";

function adminError(msg: string) {
  return { error: msg } as const;
}

/**
 * Create a new catalog category with multi-language names and slug.
 */
export async function createCategory(formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = categorySchema.safeParse({
    nameEn: raw.nameEn,
    nameAr: raw.nameAr,
    nameFr: raw.nameFr,
    slug: raw.slug || undefined,
    descriptionEn: raw.descriptionEn || undefined,
    descriptionAr: raw.descriptionAr || undefined,
    descriptionFr: raw.descriptionFr || undefined,
    image: raw.image || undefined,
    sortOrder: raw.sortOrder || undefined,
    isActive: raw.isActive === "true" || raw.isActive === "on",
  });
  if (!parsed.success) return adminError("BAD_REQUEST");

  const {
    nameEn,
    nameAr,
    nameFr,
    descriptionEn,
    descriptionAr,
    descriptionFr,
    image,
    sortOrder,
    isActive,
  } = parsed.data;

  const slug = deriveSlug(nameEn, parsed.data.slug);
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) return adminError("SLUG_TAKEN");

  const category = await prisma.category.create({
    data: {
      slug,
      nameEn,
      nameAr,
      nameFr,
      descriptionEn: descriptionEn || "",
      descriptionAr: descriptionAr || "",
      descriptionFr: descriptionFr || "",
      image: image || null,
      sortOrder,
      isActive,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "CATEGORY_CREATED",
      entity: "Category",
      entityId: category.id,
      detail: { slug, nameEn, sortOrder, isActive } as never,
    },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/categories");
  revalidatePath("/");
  return { ok: true as const, categoryId: category.id };
}

/**
 * Update an existing category's details, translations, and visibility.
 */
export async function updateCategory(formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = updateCategorySchema.safeParse({
    id: raw.id,
    nameEn: raw.nameEn,
    nameAr: raw.nameAr,
    nameFr: raw.nameFr,
    slug: raw.slug || undefined,
    descriptionEn: raw.descriptionEn || undefined,
    descriptionAr: raw.descriptionAr || undefined,
    descriptionFr: raw.descriptionFr || undefined,
    image: raw.image || undefined,
    sortOrder: raw.sortOrder || undefined,
    isActive: raw.isActive === "true" || raw.isActive === "on",
  });
  if (!parsed.success) return adminError("BAD_REQUEST");

  const {
    id,
    nameEn,
    nameAr,
    nameFr,
    descriptionEn,
    descriptionAr,
    descriptionFr,
    image,
    sortOrder,
    isActive,
  } = parsed.data;

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) return adminError("NOT_FOUND");

  const slug = deriveSlug(nameEn, parsed.data.slug);
  if (slug !== existing.slug) {
    const slugTaken = await prisma.category.findUnique({ where: { slug } });
    if (slugTaken) return adminError("SLUG_TAKEN");
  }

  const updated = await prisma.category.update({
    where: { id },
    data: {
      slug,
      nameEn,
      nameAr,
      nameFr,
      descriptionEn: descriptionEn || "",
      descriptionAr: descriptionAr || "",
      descriptionFr: descriptionFr || "",
      image: image || null,
      sortOrder,
      isActive,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "CATEGORY_UPDATED",
      entity: "Category",
      entityId: id,
      detail: { slug, nameEn, sortOrder, isActive } as never,
    },
  });

  revalidatePath("/admin/categories");
  revalidatePath(`/categories/${existing.slug}`);
  revalidatePath(`/categories/${slug}`);
  revalidatePath("/");
  return { ok: true as const, categoryId: updated.id };
}

/**
 * Delete a category (fails safely if products are linked).
 */
export async function deleteCategory(formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const id = String(raw.id ?? "");
  if (!id) return adminError("BAD_REQUEST");

  const productCount = await prisma.product.count({ where: { categoryId: id } });
  if (productCount > 0) return adminError("CATEGORY_HAS_PRODUCTS");

  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) return adminError("NOT_FOUND");

  await prisma.category.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "CATEGORY_DELETED",
      entity: "Category",
      entityId: id,
      detail: { slug: category.slug, nameEn: category.nameEn } as never,
    },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/categories");
  revalidatePath("/");
  return { ok: true as const };
}

/**
 * Toggle category active/published status.
 */
export async function toggleCategoryActive(formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const id = String(raw.id ?? "");
  if (!id) return adminError("BAD_REQUEST");

  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) return adminError("NOT_FOUND");

  const nextActive = !category.isActive;
  await prisma.category.update({
    where: { id },
    data: { isActive: nextActive },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: nextActive ? "CATEGORY_ENABLED" : "CATEGORY_DISABLED",
      entity: "Category",
      entityId: id,
      detail: { isActive: nextActive } as never,
    },
  });

  revalidatePath("/admin/categories");
  revalidatePath(`/categories/${category.slug}`);
  revalidatePath("/");
  return { ok: true as const, isActive: nextActive };
}
