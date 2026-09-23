import { describe, expect, it, afterAll, beforeAll, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/admin", () => ({
  requireAdmin: vi.fn(async () => ({
    userId: "test-admin",
    role: "ADMIN",
    email: "admin@raqmi.test",
  })),
}));

import { prisma } from "../src/lib/db";
import {
  getProducts,
  getProductBySlug,
  getProductsByCategory,
  getCategories,
  getCategory,
} from "../src/lib/catalog";
import {
  toggleProviderActive,
  deleteProductsOfDisabledProvider,
} from "../src/app/[locale]/admin/sync/actions";

const CANONICAL_SLUGS = [
  "claude-pro",
  "gemini-pro",
  "chatgpt-plus",
  "canva-pro",
  "adobe-creative",
  "youtube-premium",
  "netflix-premium",
  "spotify-premium",
  "microsoft-365",
  "windows-11-pro",
  "office-2024-pro",
  "nordvpn",
  "quillbot-premium",
  "duolingo-super",
  "capcut-pro",
  "aged-gmail-accounts",
  "cloud-developer-credits",
];

beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: "test-admin" },
    update: {},
    create: {
      id: "test-admin",
      email: "test-admin-catalog@raqmi.test",
      passwordHash: "dummy",
      role: "ADMIN",
    },
  });
  await prisma.provider.updateMany({
    where: { code: { in: ["canboso", "qcst", "vbr"] } },
    data: { isActive: true },
  });
  await prisma.product.updateMany({
    where: { slug: { in: CANONICAL_SLUGS } },
    data: { isActive: true },
  });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { actorId: "test-admin" } });
  await prisma.user.deleteMany({ where: { id: "test-admin" } });
  await prisma.$disconnect();
});

describe("DB catalog has consolidated canonical live products", () => {
  it("returns canonical products with active offers and positive prices", async () => {
    const all = await getProducts("en");
    expect(all.length).toBeGreaterThanOrEqual(CANONICAL_SLUGS.length);

    for (const slug of CANONICAL_SLUGS) {
      const p = all.find((x) => x.slug === slug);
      expect(p, `canonical product ${slug} missing from active storefront`).toBeDefined();
      expect(p!.offers.length).toBeGreaterThan(0);
      expect(p!.image).toBeTruthy();
      expect(p!.category).toBeTruthy();

      for (const off of p!.offers) {
        expect(off.price).toBeGreaterThanOrEqual(120); // Minimum price floor of 300 DA (120 cents at 250 rate)
        expect(off.baseCost).toBeGreaterThan(0);
        expect(off.agencyFee).toBeGreaterThanOrEqual(0);
        expect(off.label.en).toBeTruthy();
        expect(off.id).toMatch(/^[a-z0-9]{20,}$/);
      }
    }
  });

  it("serves categories with DB-side product counts", async () => {
    const cats = await getCategories();
    expect(cats.length).toBeGreaterThan(0);
    const ai = await getCategory("ai");
    expect(ai).toBeDefined();
    expect(ai!.count).toBeGreaterThan(0);
    expect(await getCategory("no-such-category")).toBeNull();
  });

  it("looks up by slug and by category, and 404s cleanly", async () => {
    expect(await getProductBySlug("chatgpt-plus", "en")).not.toBeNull();
    expect(await getProductBySlug("claude-pro", "en")).not.toBeNull();
    expect(await getProductBySlug("does-not-exist", "en")).toBeNull();

    const ai = await getProductsByCategory("ai", "en");
    expect(ai.length).toBeGreaterThan(0);
    expect(ai.every((p) => p.category === "ai")).toBe(true);
  });

  it("localizes labels per locale", async () => {
    const [en, ar, fr] = await Promise.all([
      getProductBySlug("chatgpt-plus", "en"),
      getProductBySlug("chatgpt-plus", "ar"),
      getProductBySlug("chatgpt-plus", "fr"),
    ]);

    expect(en).not.toBeNull();
    expect(ar).not.toBeNull();
    expect(fr).not.toBeNull();
    expect(en!.offers[0].label.en).toBeTruthy();
    expect(ar!.offers[0].label.ar).toBeTruthy();
    expect(fr!.offers[0].label.fr).toBeTruthy();
  });
});

/**
 * Regression guard for provider deactivation storefront behavior.
 */
const PAUSED_TAG = "catalog-paused-provider-test";

describe("a paused provider hides its offers from the storefront", () => {
  let providerId: string;

  async function cleanupPaused() {
    await prisma.offerProviderLink.deleteMany({
      where: { offer: { product: { slug: PAUSED_TAG } } },
    });
    await prisma.offer.deleteMany({ where: { product: { slug: PAUSED_TAG } } });
    await prisma.product.deleteMany({ where: { slug: PAUSED_TAG } });
    await prisma.category.deleteMany({ where: { slug: PAUSED_TAG } });
    await prisma.providerOffer.deleteMany({ where: { provider: { code: PAUSED_TAG } } });
    await prisma.provider.deleteMany({ where: { code: PAUSED_TAG } });
  }

  beforeAll(async () => {
    await cleanupPaused();

    const category = await prisma.category.create({
      data: { slug: PAUSED_TAG, nameEn: "P", nameAr: "P", nameFr: "P" },
    });
    const product = await prisma.product.create({
      data: { slug: PAUSED_TAG, categoryId: category.id, nameEn: "P", nameAr: "P", nameFr: "P" },
    });
    const provider = await prisma.provider.create({
      data: { code: PAUSED_TAG, displayName: "Pausable", baseUrl: "https://example.invalid" },
    });
    providerId = provider.id;

    const po = await prisma.providerOffer.create({
      data: {
        providerId: provider.id,
        providerSku: "sku-pausable",
        rawName: "pausable",
        availability: "AVAILABLE",
        costMinor: 1000n,
        currency: "USD",
      },
    });
    const offer = await prisma.offer.create({
      data: { productId: product.id, labelEn: "P", labelAr: "P", labelFr: "P" },
    });
    await prisma.offerProviderLink.create({
      data: { offerId: offer.id, providerOfferId: po.id },
    });
  });

  afterAll(cleanupPaused);

  it("lists the offer while the provider is active, and drops it once paused", async () => {
    await prisma.provider.update({ where: { id: providerId }, data: { isActive: true } });
    const live = await getProductBySlug(PAUSED_TAG, "en");
    expect(live?.offers).toHaveLength(1);
    expect(live!.offers[0].price).toBe(1000);

    await prisma.provider.update({ where: { id: providerId }, data: { isActive: false } });
    // Last sellable offer is gone, so the product itself stops rendering
    expect(await getProductBySlug(PAUSED_TAG, "en")).toBeNull();
    expect(await getProductsByCategory(PAUSED_TAG, "en")).toHaveLength(0);
    expect((await getProducts("en")).some((p) => p.slug === PAUSED_TAG)).toBe(false);
  });
});

/**
 * Tests for provider toggle and exclusive product cleanup actions in /admin/sync.
 */
const SYNC_ACTION_TAG = "sync-action-test-provider";

describe("admin sync provider toggle and product purge actions", () => {
  let providerId: string;
  let productId: string;

  async function cleanupSyncTest() {
    await prisma.offerProviderLink.deleteMany({
      where: { offer: { product: { slug: SYNC_ACTION_TAG } } },
    });
    await prisma.offer.deleteMany({ where: { product: { slug: SYNC_ACTION_TAG } } });
    await prisma.product.deleteMany({ where: { slug: SYNC_ACTION_TAG } });
    await prisma.category.deleteMany({ where: { slug: SYNC_ACTION_TAG } });
    await prisma.providerOffer.deleteMany({ where: { provider: { code: SYNC_ACTION_TAG } } });
    await prisma.provider.deleteMany({ where: { code: SYNC_ACTION_TAG } });
  }

  beforeAll(async () => {
    await cleanupSyncTest();

    const category = await prisma.category.create({
      data: { slug: SYNC_ACTION_TAG, nameEn: "SA", nameAr: "SA", nameFr: "SA" },
    });
    const product = await prisma.product.create({
      data: {
        slug: SYNC_ACTION_TAG,
        categoryId: category.id,
        nameEn: "SA Product",
        nameAr: "SA Product",
        nameFr: "SA Product",
        isActive: true,
      },
    });
    productId = product.id;

    const provider = await prisma.provider.create({
      data: { code: SYNC_ACTION_TAG, displayName: "SA Provider", baseUrl: "https://sa.invalid", isActive: true },
    });
    providerId = provider.id;

    const po = await prisma.providerOffer.create({
      data: {
        providerId: provider.id,
        providerSku: "sku-sa",
        rawName: "SA Offer",
        availability: "AVAILABLE",
        costMinor: 500n,
        currency: "USD",
      },
    });
    const offer = await prisma.offer.create({
      data: { productId: product.id, labelEn: "SA Offer", labelAr: "SA", labelFr: "SA", isActive: true },
    });
    await prisma.offerProviderLink.create({
      data: { offerId: offer.id, providerOfferId: po.id, isEnabled: true },
    });
  });

  afterAll(cleanupSyncTest);

  it("toggling provider to inactive deactivates dependent products and re-enabling reactivates them", async () => {
    const fd = new FormData();
    fd.append("providerId", providerId);

    // Toggle off
    await toggleProviderActive(fd);
    const deactivatedProvider = await prisma.provider.findUnique({ where: { id: providerId } });
    expect(deactivatedProvider?.isActive).toBe(false);

    const deactivatedProduct = await prisma.product.findUnique({ where: { id: productId } });
    expect(deactivatedProduct?.isActive).toBe(false);

    // Toggle on
    await toggleProviderActive(fd);
    const reactivatedProvider = await prisma.provider.findUnique({ where: { id: providerId } });
    expect(reactivatedProvider?.isActive).toBe(true);

    const reactivatedProduct = await prisma.product.findUnique({ where: { id: productId } });
    expect(reactivatedProduct?.isActive).toBe(true);
  });

  it("deleteProductsOfDisabledProvider deletes exclusive products of inactive provider", async () => {
    // First disable provider
    const toggleFd = new FormData();
    toggleFd.append("providerId", providerId);
    await toggleProviderActive(toggleFd);

    // Call delete
    const deleteFd = new FormData();
    deleteFd.append("providerId", providerId);
    await deleteProductsOfDisabledProvider(deleteFd);

    const checkProduct = await prisma.product.findUnique({ where: { id: productId } });
    expect(checkProduct).toBeNull();
  });
});
