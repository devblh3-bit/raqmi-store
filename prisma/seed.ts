/**
 * Seeds the DB catalog from src/data/catalog.ts — that file is the input, the DB
 * is what the storefront reads. Idempotent: re-runnable, keyed on slugs.
 *
 * Run: node prisma/seed.ts   (Node 22 strips the types natively, no tsx needed)
 *
 * Each mock offer becomes: Offer (markup 0) -> OfferProviderLink -> ProviderOffer
 * whose costMinor IS the mock price. With 0% markup the pricing engine returns
 * exactly the price the UI used to hardcode, so nothing visibly changes.
 * ponytail: one synthetic "seed" provider, no real provider SKUs — the sync job
 * will replace these ProviderOffers when provider integration goes live.
 */
import { PrismaClient } from "@prisma/client";
import { categories, products } from "../src/data/catalog.ts";

const prisma = new PrismaClient();

const providers: Array<[string, string, string]> = [
  ["qcst", "QCST", "https://api.qcst.tech"],
  ["vbr", "VenteBot", "https://ventetelegrambotrailway-production.up.railway.app"],
  ["canboso", "Canboso", "https://canboso.com"],
];

const SEED_PROVIDER = "seed";

async function main() {
  for (const [i, c] of categories.entries()) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { nameEn: c.name.en, nameAr: c.name.ar, nameFr: c.name.fr, sortOrder: i },
      create: {
        slug: c.slug,
        nameEn: c.name.en,
        nameAr: c.name.ar,
        nameFr: c.name.fr,
        sortOrder: i,
      },
    });
  }

  for (const [code, displayName, baseUrl] of providers) {
    await prisma.provider.upsert({
      where: { code },
      update: {},
      create: { code, displayName, baseUrl },
    });
  }

  await prisma.resellerTier.upsert({
    where: { name: "Standard" },
    update: {},
    create: { name: "Standard", discountPercent: 0 },
  });

  // Stand-in supplier for seeded stock; real SKUs arrive from the provider sync.
  const seedProvider = await prisma.provider.upsert({
    where: { code: SEED_PROVIDER },
    update: {},
    create: {
      code: SEED_PROVIDER,
      displayName: "Seed (placeholder supplier)",
      baseUrl: "https://seed.invalid",
    },
  });

  // Drop categories this catalog no longer defines (earlier seeds used English
  // slugs). Guarded on products:none so a populated category is never deleted.
  const removed = await prisma.category.deleteMany({
    where: { slug: { notIn: categories.map((c) => c.slug) }, products: { none: {} } },
  });
  if (removed.count) console.log(`Removed ${removed.count} stale empty categories`);

  let offerCount = 0;

  for (const [i, p] of products.entries()) {
    const category = await prisma.category.findUnique({ where: { slug: p.category } });
    if (!category) {
      // Loud rather than silently orphaning a product.
      throw new Error(`product "${p.slug}" references unknown category "${p.category}"`);
    }

    // ponytail: mock catalog is English-only, so Ar/Fr mirror En until translated.
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        categoryId: category.id,
        nameEn: p.name,
        nameAr: p.name,
        nameFr: p.name,
        descriptionEn: p.description,
        descriptionAr: p.description,
        descriptionFr: p.description,
        images: [p.image],
        isFeatured: !!p.isFeatured,
        isNew: !!p.isNew,
        soldCount: p.sold,
        sortOrder: i,
      },
      create: {
        slug: p.slug,
        categoryId: category.id,
        nameEn: p.name,
        nameAr: p.name,
        nameFr: p.name,
        descriptionEn: p.description,
        descriptionAr: p.description,
        descriptionFr: p.description,
        images: [p.image],
        isFeatured: !!p.isFeatured,
        isNew: !!p.isNew,
        soldCount: p.sold,
        sortOrder: i,
      },
    });

    for (const [j, o] of p.offers.entries()) {
      const sku = `${p.slug}:${o.id}`;

      const providerOffer = await prisma.providerOffer.upsert({
        where: { providerId_providerSku: { providerId: seedProvider.id, providerSku: sku } },
        update: {
          costMinor: BigInt(o.price),
          currency: "USD",
          availability: "AVAILABLE",
          stockQuantity: o.stock ?? null,
          rawName: `${p.name} — ${o.label.en}`,
        },
        create: {
          providerId: seedProvider.id,
          providerSku: sku,
          rawName: `${p.name} — ${o.label.en}`,
          rawNameEn: `${p.name} — ${o.label.en}`,
          availability: "AVAILABLE",
          stockQuantity: o.stock ?? null,
          costMinor: BigInt(o.price),
          currency: "USD",
          fulfillmentMode: "sync",
        },
      });

      // Offer has no natural unique key, so match on (productId, labelEn).
      const existing = await prisma.offer.findFirst({
        where: { productId: product.id, labelEn: o.label.en },
        select: { id: true },
      });

      const data = {
        productId: product.id,
        labelEn: o.label.en,
        labelAr: o.label.ar,
        labelFr: o.label.fr,
        markupPercent: 0,
        compareAtMinor: o.compareAt != null ? BigInt(o.compareAt) : null,
        badge: o.badge ?? null,
        sortOrder: j,
      };

      const offer = existing
        ? await prisma.offer.update({ where: { id: existing.id }, data })
        : await prisma.offer.create({ data });

      await prisma.offerProviderLink.upsert({
        where: {
          offerId_providerOfferId: { offerId: offer.id, providerOfferId: providerOffer.id },
        },
        update: { isEnabled: true, priority: 0 },
        create: { offerId: offer.id, providerOfferId: providerOffer.id, priority: 0 },
      });

      offerCount++;
    }
  }

  console.log(
    `Seeded ${categories.length} categories, ${providers.length + 1} providers, 1 tier, ` +
      `${products.length} products, ${offerCount} offers`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
