import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { Locale } from "@/i18n";
import { convertMinor } from "./money";
import { usdRateFor } from "./pricing";
import { getSystemSettings } from "./settings";

/**
 * DB-backed catalog reads. Returns the same shape the storefront already
 * renders (src/data/catalog.ts types), so pages swap their import and nothing
 * else changes.
 *
 * Prices come from OfferProviderLink -> ProviderOffer.costMinor with the offer's
 * markup applied, mirroring pricing.ts's retail path. This is the DISPLAY path:
 * it stays read-only and never writes the OfferComputedPrice cache. Checkout
 * re-prices through priceForOffer(), which is authoritative.
 * ponytail: no tier pricing in listings (retail only) — logged-in reseller
 * discounts show at checkout. Upgrade path: pass tierId through and reuse
 * computeOfferPrice here.
 */

export type CatalogOffer = {
  id: string; // real Offer.id — this is what checkout takes
  label: Record<string, string>;
  rules?: Record<string, string>;
  price: number; // USD minor
  compareAt?: number;
  stock?: number;
  badge?: string;
  /** Provider wants a value from the buyer (e.g. the account email) before fulfillment. */
  requiresCustomerInput: boolean;
  customerPrompt?: string;
};

export type CatalogProduct = {
  slug: string;
  category: string;
  name: string;
  description: string;
  image: string;
  sold: number;
  offers: CatalogOffer[];
  isNew?: boolean;
  isFeatured?: boolean;
};

export type CatalogCategory = {
  slug: string;
  name: Record<string, string>;
  count: number;
};

const localized = (en: string, ar: string, fr: string) => ({ en, ar, fr });

function pick(row: { nameEn: string; nameAr: string; nameFr: string }, locale: Locale) {
  return locale === "ar" ? row.nameAr : locale === "fr" ? row.nameFr : row.nameEn;
}

const offerSelect = {
  id: true,
  labelEn: true,
  labelAr: true,
  labelFr: true,
  rulesEn: true,
  rulesAr: true,
  rulesFr: true,
  markupPercent: true,
  compareAtMinor: true,
  badge: true,
  links: {
    // Paused provider = link disabled, mirroring pricing.ts so the storefront
    // never lists an offer checkout would refuse with NO_ENABLED_LINK.
    where: { isEnabled: true, providerOffer: { provider: { isActive: true } } },
    orderBy: [{ priority: "asc" }],
    select: {
      providerOffer: {
        select: {
          costMinor: true,
          currency: true,
          availability: true,
          stockQuantity: true,
          customerInputType: true,
          customerPrompt: true,
        },
      },
    },
  },
} satisfies Prisma.OfferSelect;

const productInclude = {
  category: { select: { slug: true } },
  offers: {
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }],
    select: offerSelect,
  },
} satisfies Prisma.ProductInclude;

type ProductRow = Awaited<ReturnType<typeof loadProducts>>[number];

function loadProducts(where: Prisma.ProductWhereInput) {
  return prisma.product.findMany({
    where: { isActive: true, ...where },
    include: productInclude,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

function toOffer(
  o: ProductRow["offers"][number],
  minPriceMinor?: number,
): CatalogOffer | null {
  // Cheapest enabled link in USD (or converted to USD) wins, matching computeOfferPrice's selection.
  const usable = o.links
    .map((l) => {
      const po = l.providerOffer;
      if (po.availability === "OUT_OF_STOCK") return null;
      const isUsd = po.currency.toUpperCase() === "USD";
      if (isUsd) {
        return { po, usdCostMinor: Number(po.costMinor) };
      }
      const rate = usdRateFor(po.currency);
      if (rate === null) return null;
      const converted = convertMinor({
        amountMinor: Number(po.costMinor),
        fromCurrency: po.currency,
        toCurrency: "USD",
        rate,
      });
      return { po, usdCostMinor: converted };
    })
    .filter((x): x is { po: (typeof o.links)[number]["providerOffer"]; usdCostMinor: number } => x !== null);

  if (!usable.length) return null;
  const best = usable.reduce((a, b) => (b.usdCostMinor < a.usdCostMinor ? b : a));

  const markup = Number(o.markupPercent);
  const rawPrice = Math.round(best.usdCostMinor * (1 + markup / 100));
  const price = minPriceMinor !== undefined ? Math.max(rawPrice, minPriceMinor) : rawPrice;

  const inputType = best.po.customerInputType;
  return {
    id: o.id,
    label: localized(o.labelEn, o.labelAr, o.labelFr),
    rules: localized(o.rulesEn, o.rulesAr, o.rulesFr),
    price,
    compareAt: o.compareAtMinor == null ? undefined : Number(o.compareAtMinor),
    stock: best.po.stockQuantity ?? undefined,
    badge: o.badge ?? undefined,
    // Mirrors checkout.ts's rule so the form asks for exactly what placeOrder requires.
    requiresCustomerInput: !!inputType && inputType !== "none",
    customerPrompt: best.po.customerPrompt ?? undefined,
  };
}

function toProduct(p: ProductRow, locale: Locale, minPriceMinor?: number): CatalogProduct | null {
  const offers = p.offers.map((o) => toOffer(o, minPriceMinor)).filter((o): o is CatalogOffer => o !== null);
  if (!offers.length) return null; // nothing sellable; hide rather than render a broken card
  return {
    slug: p.slug,
    category: p.category.slug,
    name: pick(p, locale),
    description:
      locale === "ar" ? p.descriptionAr : locale === "fr" ? p.descriptionFr : p.descriptionEn,
    image: p.images[0] ?? "",
    sold: p.soldCount,
    offers,
    isNew: p.isNew,
    isFeatured: p.isFeatured,
  };
}

async function resolveMinPriceFloor(): Promise<number> {
  try {
    if (typeof getSystemSettings === "function") {
      const settings = await getSystemSettings();
      if (settings?.dzdRate && settings?.minOfferPriceDzd !== undefined) {
        return Math.ceil((settings.minOfferPriceDzd / settings.dzdRate) * 100);
      }
    }
  } catch {
    // Fall back to 300 DA / 240 rate
  }
  return Math.ceil((300 / 240) * 100);
}

export async function getProducts(locale: Locale): Promise<CatalogProduct[]> {
  const [rows, minPriceMinor] = await Promise.all([loadProducts({}), resolveMinPriceFloor()]);
  return rows.map((p) => toProduct(p, locale, minPriceMinor)).filter((p): p is CatalogProduct => p !== null);
}

export async function getProductBySlug(
  slug: string,
  locale: Locale,
): Promise<CatalogProduct | null> {
  const [[row], minPriceMinor] = await Promise.all([loadProducts({ slug }), resolveMinPriceFloor()]);
  return row ? toProduct(row, locale, minPriceMinor) : null;
}

export async function getProductsByCategory(
  categorySlug: string,
  locale: Locale,
): Promise<CatalogProduct[]> {
  const [rows, minPriceMinor] = await Promise.all([
    loadProducts({ category: { slug: categorySlug } }),
    resolveMinPriceFloor(),
  ]);
  return rows.map((p) => toProduct(p, locale, minPriceMinor)).filter((p): p is CatalogProduct => p !== null);
}

export async function getCategories(): Promise<CatalogCategory[]> {
  const rows = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }],
    select: {
      slug: true,
      nameEn: true,
      nameAr: true,
      nameFr: true,
      _count: { select: { products: { where: { isActive: true } } } },
    },
  });
  return rows.map((c) => ({
    slug: c.slug,
    name: localized(c.nameEn, c.nameAr, c.nameFr),
    count: c._count.products,
  }));
}

export async function getCategory(slug: string): Promise<CatalogCategory | null> {
  return (await getCategories()).find((c) => c.slug === slug) ?? null;
}
