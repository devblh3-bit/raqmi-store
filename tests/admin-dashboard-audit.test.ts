import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/admin", () => ({
  requireAdmin: vi.fn(async () => ({
    userId: "admin-dashboard-tester",
    email: "admin-dash@test.com",
    role: "ADMIN",
  })),
}));

import { prisma } from "../src/lib/db";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryActive,
} from "../src/app/[locale]/admin/categories/actions";

const TEST_TAG = "test-dashboard-audit";

describe("Admin Categories & Audit Activity", () => {
  const adminUserId = "admin-dashboard-tester";
  let createdCategoryId: string;

  async function cleanup() {
    await prisma.auditLog.deleteMany({
      where: { actorId: adminUserId },
    });
    await prisma.product.deleteMany({
      where: { slug: { startsWith: TEST_TAG } },
    });
    await prisma.category.deleteMany({
      where: { slug: { startsWith: TEST_TAG } },
    });
    await prisma.user.deleteMany({
      where: { id: adminUserId },
    });
  }

  beforeAll(async () => {
    await cleanup();

    await prisma.user.create({
      data: {
        id: adminUserId,
        email: "admin-dash@test.com",
        role: "ADMIN",
      },
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  it("creates a new category with multi-language names and records audit log", async () => {
    const fd = new FormData();
    fd.append("nameEn", "Streaming Services");
    fd.append("nameAr", "خدمات البث المباشر");
    fd.append("nameFr", "Services de Streaming");
    fd.append("slug", `${TEST_TAG}-streaming`);
    fd.append("descriptionEn", "Best digital subscriptions");
    fd.append("sortOrder", "1");
    fd.append("isActive", "true");

    const res = await createCategory(fd);
    expect("ok" in res && res.ok).toBe(true);
    if (!("ok" in res)) throw new Error("create failed");
    createdCategoryId = res.categoryId;

    const cat = await prisma.category.findUniqueOrThrow({
      where: { id: createdCategoryId },
    });
    expect(cat.nameEn).toBe("Streaming Services");
    expect(cat.nameAr).toBe("خدمات البث المباشر");
    expect(cat.nameFr).toBe("Services de Streaming");
    expect(cat.slug).toBe(`${TEST_TAG}-streaming`);
    expect(cat.isActive).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "CATEGORY_CREATED", entityId: createdCategoryId },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(adminUserId);
  });

  it("updates an existing category details and translations", async () => {
    const fd = new FormData();
    fd.append("id", createdCategoryId);
    fd.append("nameEn", "Streaming & TV");
    fd.append("nameAr", "البث والتلفزيون");
    fd.append("nameFr", "Streaming & Télé");
    fd.append("slug", `${TEST_TAG}-streaming-tv`);
    fd.append("sortOrder", "2");
    fd.append("isActive", "true");

    const res = await updateCategory(fd);
    expect("ok" in res && res.ok).toBe(true);

    const updated = await prisma.category.findUniqueOrThrow({
      where: { id: createdCategoryId },
    });
    expect(updated.nameEn).toBe("Streaming & TV");
    expect(updated.slug).toBe(`${TEST_TAG}-streaming-tv`);
    expect(updated.sortOrder).toBe(2);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "CATEGORY_UPDATED", entityId: createdCategoryId },
    });
    expect(audit).not.toBeNull();
  });

  it("toggles category visibility (isActive)", async () => {
    const fd = new FormData();
    fd.append("id", createdCategoryId);

    const res = await toggleCategoryActive(fd);
    expect("ok" in res && res.ok).toBe(true);
    if (!("ok" in res)) throw new Error("toggle failed");
    expect(res.isActive).toBe(false);

    const disabledCat = await prisma.category.findUniqueOrThrow({
      where: { id: createdCategoryId },
    });
    expect(disabledCat.isActive).toBe(false);

    // Toggle back
    const resBack = await toggleCategoryActive(fd);
    expect("ok" in resBack && resBack.ok).toBe(true);
    if (!("ok" in resBack)) throw new Error("toggle failed");
    expect(resBack.isActive).toBe(true);
  });

  it("refuses to delete a category when products are linked, and deletes when empty", async () => {
    // 1. Create a product linked to this category
    const prod = await prisma.product.create({
      data: {
        slug: `${TEST_TAG}-prod`,
        nameEn: "Test Linked Product",
        nameAr: "منتج مرتبط",
        nameFr: "Produit Lié",
        categoryId: createdCategoryId,
      },
    });

    // 2. Attempt deletion -> should fail with CATEGORY_HAS_PRODUCTS
    const fd = new FormData();
    fd.append("id", createdCategoryId);

    const resBlocked = await deleteCategory(fd);
    expect(resBlocked).toEqual({ error: "CATEGORY_HAS_PRODUCTS" });

    // 3. Remove product
    await prisma.product.delete({ where: { id: prod.id } });

    // 4. Attempt deletion again -> should succeed
    const resSuccess = await deleteCategory(fd);
    expect("ok" in resSuccess && resSuccess.ok).toBe(true);

    const deleted = await prisma.category.findUnique({
      where: { id: createdCategoryId },
    });
    expect(deleted).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: "CATEGORY_DELETED", entityId: createdCategoryId },
    });
    expect(audit).not.toBeNull();
  });
});
