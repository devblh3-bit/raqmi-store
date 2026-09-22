import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/admin", () => ({
  requireAdmin: vi.fn(async () => ({
    userId: "admin-catalog-test-id",
    email: "admin-catalog@test.com",
    role: "ADMIN",
  })),
}));

import { prisma } from "../src/lib/db";
import { autoTranslateStoreText } from "../src/lib/catalog/translation";
import {
  toggleProductActive,
  toggleProductFeatured,
  bulkUpdateProductStatus,
  bulkUpdateProductCategory,
  createProductFromProviderOffer,
  linkProviderOfferToExistingProduct,
  createProductWithInitialOffer,
} from "../src/app/[locale]/admin/catalog/actions";

const TEST_TAG = "test-catalog-cmd";

describe("Admin Catalog Command Center & 60-Second Setup", () => {
  let cat1Id: string;
  let cat2Id: string;
  let providerId: string;
  let providerOffer1Id: string;
  let providerOffer2Id: string;

  async function cleanup() {
    await prisma.auditLog.deleteMany({
      where: { actorId: "admin-catalog-test-id" },
    });
    await prisma.offerProviderLink.deleteMany({
      where: { providerOffer: { provider: { code: TEST_TAG } } },
    });
    await prisma.offer.deleteMany({
      where: { product: { category: { slug: { in: [`${TEST_TAG}-1`, `${TEST_TAG}-2`] } } } },
    });
    await prisma.product.deleteMany({
      where: { category: { slug: { in: [`${TEST_TAG}-1`, `${TEST_TAG}-2`] } } },
    });
    await prisma.category.deleteMany({
      where: { slug: { in: [`${TEST_TAG}-1`, `${TEST_TAG}-2`] } },
    });
    await prisma.providerOffer.deleteMany({
      where: { provider: { code: TEST_TAG } },
    });
    await prisma.provider.deleteMany({
      where: { code: TEST_TAG },
    });
    await prisma.user.deleteMany({
      where: { id: "admin-catalog-test-id" },
    });
  }

  beforeAll(async () => {
    await cleanup();

    await prisma.user.create({
      data: {
        id: "admin-catalog-test-id",
        email: "admin-catalog@test.com",
        role: "ADMIN",
      },
    });

    const c1 = await prisma.category.create({
      data: {
        slug: `${TEST_TAG}-1`,
        nameEn: "Gaming Test",
        nameAr: "ألعاب تجريبية",
        nameFr: "Jeux Test",
      },
    });
    cat1Id = c1.id;

    const c2 = await prisma.category.create({
      data: {
        slug: `${TEST_TAG}-2`,
        nameEn: "Gift Cards Test",
        nameAr: "بطاقات تجريبية",
        nameFr: "Cartes Test",
      },
    });
    cat2Id = c2.id;

    const prov = await prisma.provider.create({
      data: {
        code: TEST_TAG,
        displayName: "E-Pin Digital Test",
        baseUrl: "https://api.test.com",
        isActive: true,
      },
    });
    providerId = prov.id;

    const po1 = await prisma.providerOffer.create({
      data: {
        providerId,
        providerSku: `${TEST_TAG}-SKU-1`,
        rawName: "Free Fire 100 Diamonds",
        rawNameEn: "Free Fire 100 Diamonds",
        costMinor: 21000n, // $210.00 minor
        currency: "DZD",
        availability: "AVAILABLE",
      },
    });
    providerOffer1Id = po1.id;

    const po2 = await prisma.providerOffer.create({
      data: {
        providerId,
        providerSku: `${TEST_TAG}-SKU-2`,
        rawName: "Free Fire 310 Diamonds",
        rawNameEn: "Free Fire 310 Diamonds",
        costMinor: 62000n,
        currency: "DZD",
        availability: "AVAILABLE",
      },
    });
    providerOffer2Id = po2.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("translates digital store terms accurately to Arabic and French", () => {
    const res = autoTranslateStoreText("Free Fire 100 Diamonds");
    expect(res.ar).toContain("مجوهرات");
    expect(res.fr).toContain("Diamants");

    const giftCard = autoTranslateStoreText("Steam Gift Card 1 Month");
    expect(giftCard.ar).toContain("بطاقة هدايا");
    expect(giftCard.ar).toContain("شهر واحد");
    expect(giftCard.fr).toContain("Carte Cadeau");
    expect(giftCard.fr).toContain("1 Mois");
  });

  it("1-click creates a new product directly from an unlinked provider offer", async () => {
    const result = await createProductFromProviderOffer(providerOffer1Id, cat1Id, 20);
    expect("error" in result).toBe(false);
    if ("error" in result) return;

    expect(result.ok).toBe(true);
    expect(result.productId).toBeDefined();
    expect(result.offerId).toBeDefined();

    // Verify product in database
    const product = await prisma.product.findUnique({
      where: { id: result.productId },
      include: {
        offers: {
          include: { links: true },
        },
      },
    });
    expect(product).toBeDefined();
    expect(product!.nameEn).toBe("Free Fire 100 Diamonds");
    expect(product!.nameAr).toContain("مجوهرات");
    expect(product!.categoryId).toBe(cat1Id);
    expect(product!.offers).toHaveLength(1);
    expect(Number(product!.offers[0].markupPercent)).toBe(20);
    expect(product!.offers[0].links).toHaveLength(1);
    expect(product!.offers[0].links[0].providerOfferId).toBe(providerOffer1Id);
  });

  it("attaches another unlinked provider offer as a new variant to the existing product", async () => {
    const existing = await prisma.product.findFirst({
      where: { slug: { startsWith: "free-fire-100-diamonds" } },
    });
    expect(existing).toBeDefined();

    const result = await linkProviderOfferToExistingProduct(
      existing!.id,
      providerOffer2Id,
      "310 Diamonds",
      15
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;

    expect(result.ok).toBe(true);

    // Verify variant was added
    const updated = await prisma.product.findUnique({
      where: { id: existing!.id },
      include: { offers: true },
    });
    expect(updated!.offers).toHaveLength(2);
    const variant2 = updated!.offers.find((o) => o.labelEn === "310 Diamonds");
    expect(variant2).toBeDefined();
    expect(variant2!.labelAr).toContain("مجوهرات");
    expect(Number(variant2!.markupPercent)).toBe(15);
  });

  it("toggles product active and featured states with 0-click instant response", async () => {
    const p = await prisma.product.findFirst({
      where: { slug: { startsWith: "free-fire-100-diamonds" } },
    });
    expect(p).toBeDefined();

    // Toggle active
    const t1 = await toggleProductActive(p!.id);
    expect("error" in t1).toBe(false);
    if ("error" in t1) return;
    expect(t1.isActive).toBe(false);

    const check1 = await prisma.product.findUnique({ where: { id: p!.id } });
    expect(check1!.isActive).toBe(false);

    // Toggle back
    const t2 = await toggleProductActive(p!.id);
    if ("error" in t2) return;
    expect(t2.isActive).toBe(true);

    // Toggle featured
    const f1 = await toggleProductFeatured(p!.id);
    if ("error" in f1) return;
    expect(f1.isFeatured).toBe(true);

    const check2 = await prisma.product.findUnique({ where: { id: p!.id } });
    expect(check2!.isFeatured).toBe(true);
  });

  it("performs bulk status and category updates across multiple products", async () => {
    // Create 2 temporary products
    const p1 = await prisma.product.create({
      data: {
        slug: `${TEST_TAG}-bulk-1`,
        nameEn: "Bulk 1",
        nameAr: "دفعة 1",
        nameFr: "Lot 1",
        categoryId: cat1Id,
        isActive: true,
      },
    });
    const p2 = await prisma.product.create({
      data: {
        slug: `${TEST_TAG}-bulk-2`,
        nameEn: "Bulk 2",
        nameAr: "دفعة 2",
        nameFr: "Lot 2",
        categoryId: cat1Id,
        isActive: true,
      },
    });

    const ids = [p1.id, p2.id];

    // Bulk deactivate
    const bulkStatus = await bulkUpdateProductStatus(ids, false);
    expect("error" in bulkStatus).toBe(false);

    const checkDeactivated = await prisma.product.findMany({
      where: { id: { in: ids } },
    });
    expect(checkDeactivated.every((p) => p.isActive === false)).toBe(true);

    // Bulk move category
    const bulkCat = await bulkUpdateProductCategory(ids, cat2Id);
    expect("error" in bulkCat).toBe(false);

    const checkCategory = await prisma.product.findMany({
      where: { id: { in: ids } },
    });
    expect(checkCategory.every((p) => p.categoryId === cat2Id)).toBe(true);
  });

  it("creates a product with English-only input and auto-translations via 60-second wizard", async () => {
    const fd = new FormData();
    fd.set("nameEn", `${TEST_TAG} Netflix Premium Subscription`);
    fd.set("categoryId", cat2Id);
    fd.set("variantLabel", "1 Month Standard");
    fd.set("variantMarkup", "18");

    const result = await createProductWithInitialOffer(fd);
    expect("error" in result).toBe(false);
    if ("error" in result) return;

    const created = await prisma.product.findUnique({
      where: { id: result.id },
      include: { offers: true },
    });
    expect(created).toBeDefined();
    expect(created!.nameAr).toContain("اشتراك");
    expect(created!.nameFr).toContain("Abonnement");
    expect(created!.offers).toHaveLength(1);
    expect(created!.offers[0].labelEn).toBe("1 Month Standard");
    expect(created!.offers[0].labelAr).toContain("شهر واحد");
    expect(Number(created!.offers[0].markupPercent)).toBe(18);
  });
});
