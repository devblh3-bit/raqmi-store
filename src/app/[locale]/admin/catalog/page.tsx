import { prisma } from "@/lib/db";
import { CatalogView } from "./catalog-view";
import type { CatalogProduct } from "./catalog-table";
import type { UnlinkedProviderOffer, ExistingProductOption } from "./unlinked-offers-inbox";

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  const where = q
    ? {
        OR: [
          { nameEn: { contains: q, mode: "insensitive" as const } },
          { slug: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [categories, productsRaw, unlinkedOffersRaw] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, nameEn: true },
    }),
    prisma.product.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        category: { select: { id: true, slug: true, nameEn: true } },
        offers: {
          include: {
            links: {
              include: {
                providerOffer: {
                  select: {
                    availability: true,
                    costMinor: true,
                    currency: true,
                    stockQuantity: true,
                  },
                },
              },
            },
          },
        },
        _count: { select: { offers: true } },
      },
      take: 300,
    }),
    prisma.providerOffer.findMany({
      where: {
        links: { none: {} },
      },
      orderBy: { lastSyncedAt: "desc" },
      include: {
        provider: { select: { code: true, displayName: true } },
      },
      take: 150,
    }),
  ]);

  // Transform products
  const products: CatalogProduct[] = productsRaw.map((p) => {
    let health: "HEALTHY" | "PARTIAL" | "OUT_OF_STOCK" | "MANUAL" | "EMPTY" = "EMPTY";
    if (p.offers.length === 0) {
      health = "EMPTY";
    } else {
      let linkedOffersCount = 0;
      let availableOffersCount = 0;
      let outOfStockOffersCount = 0;

      for (const off of p.offers) {
        const activeLink = off.links.find((l) => l.isEnabled);
        if (activeLink) {
          linkedOffersCount++;
          if (activeLink.providerOffer.availability === "AVAILABLE") {
            availableOffersCount++;
          } else if (activeLink.providerOffer.availability === "OUT_OF_STOCK") {
            outOfStockOffersCount++;
          }
        }
      }

      if (linkedOffersCount === 0) {
        health = "MANUAL";
      } else if (availableOffersCount === p.offers.length) {
        health = "HEALTHY";
      } else if (outOfStockOffersCount === linkedOffersCount) {
        health = "OUT_OF_STOCK";
      } else {
        health = "PARTIAL";
      }
    }

    // Determine pricing summary
    let priceSummary = "—";
    const validPrices: number[] = [];
    for (const off of p.offers) {
      if (off.compareAtMinor != null) {
        validPrices.push(Number(off.compareAtMinor));
      } else {
        const activeLink = off.links.find((l) => l.isEnabled);
        if (activeLink) {
          const cost = Number(activeLink.providerOffer.costMinor);
          const markup = Number(off.markupPercent);
          const retail = Math.round(cost * (1 + markup / 100));
          validPrices.push(retail);
        }
      }
    }

    if (validPrices.length > 0) {
      const min = Math.min(...validPrices);
      const max = Math.max(...validPrices);
      const formatMinor = (minor: number) => {
        const val = (minor / 100).toFixed(0);
        return `${Number(val).toLocaleString()} DZD`;
      };
      if (min === max) {
        priceSummary = formatMinor(min);
      } else {
        priceSummary = `${formatMinor(min)} – ${formatMinor(max)}`;
      }
    }

    return {
      id: p.id,
      slug: p.slug,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      nameFr: p.nameFr,
      isActive: p.isActive,
      isFeatured: p.isFeatured,
      sortOrder: p.sortOrder,
      category: p.category,
      offerCount: p._count.offers,
      health,
      priceSummary,
    };
  });

  // Transform unlinked offers
  const unlinkedOffers: UnlinkedProviderOffer[] = unlinkedOffersRaw.map((o) => ({
    id: o.id,
    providerSku: o.providerSku,
    rawName: o.rawName,
    rawNameEn: o.rawNameEn,
    costMinor: o.costMinor.toString(),
    currency: o.currency,
    availability: o.availability,
    stockQuantity: o.stockQuantity,
    lastSyncedAt: o.lastSyncedAt.toISOString(),
    provider: o.provider,
  }));

  // Options for linking existing products
  const existingProductOptions: ExistingProductOption[] = productsRaw.map((p) => ({
    id: p.id,
    nameEn: p.nameEn,
    slug: p.slug,
    categoryName: p.category.nameEn,
  }));

  return (
    <CatalogView
      products={products}
      categories={categories}
      unlinkedOffers={unlinkedOffers}
      existingProductOptions={existingProductOptions}
      locale={locale}
    />
  );
}
