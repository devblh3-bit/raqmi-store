import { describe, expect, it, afterAll, vi } from "vitest";

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

describe("DB catalog matches the seed source", () => {
  it("returns every seeded product with cheapest-price parity", async () => {
    const all = await getProducts("en");
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
    const all = await getProducts("en");
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
    const all = await getProducts("en");
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
    const cats = await getCategories();
    expect(cats).toHaveLength(mockCategories.length);
    expect(cats.reduce((s, c) => s + c.count, 0)).toBe(mock.length);

    const ai = await getCategory("ai");
    expect(ai?.count).toBe(mock.filter((p) => p.category === "ai").length);
    expect(await getCategory("no-such-category")).toBeNull();
  });

  it("looks up by slug and by category, and 404s cleanly", async () => {
    expect(await getProductBySlug("chatgpt-plus", "en")).not.toBeNull();
    expect(await getProductBySlug("does-not-exist", "en")).toBeNull();

    const ai = await getProductsByCategory("ai", "en");
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
