import { describe, expect, it, afterAll, beforeAll, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "../src/lib/db";
import {
  getProducts,
  getProductBySlug,
  getProductsByCategory,
  getCategories,
  getCategory,
} from "../src/lib/catalog";
import { products as mock, categories as mockCategories } from "../src/data/catalog";

/**
 * Integration test — needs the raqmi-pg container AND a seeded catalog
 * (`node prisma/seed.ts`). It is the parity guard for the mock->DB migration:
 * src/data/catalog.ts is the seed's input, so if someone edits that file and
 * forgets to re-seed, these assertions fail loudly instead of the storefront
 * silently drifting from its own source data.
 */

afterAll(async () => {
  await prisma.$disconnect();
});

// Vitest runs test files in parallel against one database, and other suites
// create their own throwaway categories/products. So assert over the slugs the
// seed owns, never over whole-table counts.
const SEEDED_PRODUCTS = new Set(mock.map((p) => p.slug));
const SEEDED_CATEGORIES = new Set(mockCategories.map((c) => c.slug));
const seededOnly = <T extends { slug: string }>(rows: T[]) =>
  rows.filter((r) => SEEDED_PRODUCTS.has(r.slug));

describe("DB catalog matches the seed source", () => {
  it("returns every seeded product with cheapest-price parity", async () => {
    const all = seededOnly(await getProducts("en"));
    expect(all).toHaveLength(mock.length);

    for (const m of mock) {
      const p = all.find((x) => x.slug === m.slug);
      expect(p, `product ${m.slug} missing from DB`).toBeDefined();
      expect(p!.offers).toHaveLength(m.offers.length);
      expect(p!.sold).toBe(m.sold);
      expect(p!.image).toBe(m.image);
      expect(p!.category).toBe(m.category);
      // what ProductCard renders
      expect(Math.min(...p!.offers.map((o) => o.price))).toBe(
        Math.min(...m.offers.map((o) => o.price)),
      );
    }
  });

  it("round-trips every offer's price, compareAt, badge and stock", async () => {
    const all = seededOnly(await getProducts("en"));
    for (const m of mock) {
      const p = all.find((x) => x.slug === m.slug)!;
      for (const mo of m.offers) {
        const o = p.offers.find((x) => x.label.en === mo.label.en);
        expect(o, `${m.slug}/${mo.label.en} missing`).toBeDefined();
        expect(o!.price).toBe(mo.price);
        expect(o!.compareAt).toBe(mo.compareAt);
        expect(o!.badge).toBe(mo.badge);
        expect(o!.stock).toBe(mo.stock);
        // real Offer.id, not the mock's "1m"/"3m" — this is what checkout takes
        expect(o!.id).toMatch(/^[a-z0-9]{20,}$/);
      }
    }
  });

  it("preserves the home-page and promo partitions", async () => {
    const all = seededOnly(await getProducts("en"));
    expect(all.filter((p) => p.isFeatured)).toHaveLength(
      mock.filter((p) => p.isFeatured).length,
    );
    expect(all.filter((p) => p.isNew)).toHaveLength(mock.filter((p) => p.isNew).length);

    const promo = (list: { offers: { price: number; compareAt?: number }[] }[]) =>
      list.filter((p) => p.offers.some((o) => o.compareAt && o.compareAt > o.price)).length;
    expect(promo(all)).toBe(promo(mock));
    expect(promo(all)).toBeGreaterThan(0); // guards against compareAt silently dropping
  });

  it("serves categories with DB-side product counts", async () => {
    const cats = (await getCategories()).filter((c) => SEEDED_CATEGORIES.has(c.slug));
    expect(cats).toHaveLength(mockCategories.length);
    expect(cats.reduce((s, c) => s + c.count, 0)).toBe(mock.length);

    const ai = await getCategory("ai");
    expect(ai?.count).toBe(mock.filter((p) => p.category === "ai").length);
    expect(await getCategory("no-such-category")).toBeNull();
  });

  it("looks up by slug and by category, and 404s cleanly", async () => {
    expect(await getProductBySlug("chatgpt-plus", "en")).not.toBeNull();
    expect(await getProductBySlug("does-not-exist", "en")).toBeNull();

    const ai = seededOnly(await getProductsByCategory("ai", "en"));
    expect(ai).toHaveLength(mock.filter((p) => p.category === "ai").length);
    expect(ai.every((p) => p.category === "ai")).toBe(true);
  });

  it("localizes labels per locale", async () => {
    const [en, ar, fr] = await Promise.all([
      getProductBySlug("chatgpt-plus", "en"),
      getProductBySlug("chatgpt-plus", "ar"),
      getProductBySlug("chatgpt-plus", "fr"),
    ]);
    const m = mock.find((p) => p.slug === "chatgpt-plus")!;
    expect(en!.offers[0].label.en).toBe(m.offers[0].label.en);
    expect(ar!.offers[0].label.ar).toBe(m.offers[0].label.ar);
    expect(fr!.offers[0].label.fr).toBe(m.offers[0].label.fr);
  });
});

/**
 * Regression guard for the display/checkout parity bug: the storefront listed
 * offers whose only link pointed at a paused provider, so the card showed a
 * price and a Buy button while placeOrder refused them with NO_ENABLED_LINK.
 * pricing.ts treats a paused provider as a disabled link; catalog.ts has to
 * agree, or buyers reach checkout on offers that cannot be sold.
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
        providerId: provider.id, providerSku: "sku-pausable", rawName: "pausable",
        availability: "AVAILABLE", costMinor: 1000n, currency: "USD",
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
    // rather than showing a card with no buyable variant.
    expect(await getProductBySlug(PAUSED_TAG, "en")).toBeNull();
    expect((await getProductsByCategory(PAUSED_TAG, "en"))).toHaveLength(0);
    expect((await getProducts("en")).some((p) => p.slug === PAUSED_TAG)).toBe(false);
  });
});
