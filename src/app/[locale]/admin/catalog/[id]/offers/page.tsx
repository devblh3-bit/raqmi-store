import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { OfferStudio, SerializedOffer, SerializedProviderOffer } from "./offer-studio";

export default async function OffersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ q?: string; provider?: string }>;
}) {
  const { locale, id } = await params;
  const { q, provider } = await searchParams;

  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, nameEn: true, nameAr: true, nameFr: true, slug: true },
  });
  if (!product) notFound();

  const [rawOffers, rawPool, rawProviders] = await Promise.all([
    prisma.offer.findMany({
      where: { productId: id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        links: {
          orderBy: { priority: "asc" },
          include: {
            providerOffer: {
              include: {
                provider: { select: { code: true, displayName: true } },
              },
            },
          },
        },
      },
    }),
    prisma.providerOffer.findMany({
      where: {
        ...(provider ? { provider: { code: provider } } : {}),
        ...(q
          ? {
              OR: [
                { rawName: { contains: q, mode: "insensitive" } },
                { rawNameEn: { contains: q, mode: "insensitive" } },
                { providerSku: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastSyncedAt: "desc" }],
      take: 60,
      include: {
        provider: { select: { code: true, displayName: true } },
      },
    }),
    prisma.provider.findMany({
      select: { code: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
  ]);

  // Serialize BigInts & Decimals for Client Component
  const serializedOffers: SerializedOffer[] = rawOffers.map((o) => ({
    id: o.id,
    labelEn: o.labelEn,
    labelAr: o.labelAr,
    labelFr: o.labelFr,
    rulesEn: o.rulesEn,
    rulesAr: o.rulesAr,
    rulesFr: o.rulesFr,
    markupPercent: Number(o.markupPercent),
    compareAtMinor: o.compareAtMinor ? o.compareAtMinor.toString() : null,
    badge: o.badge,
    productPinned: o.productPinned,
    stockQty: o.stockQty,
    isActive: o.isActive,
    links: o.links.map((l) => ({
      id: l.id,
      priority: l.priority,
      isEnabled: l.isEnabled,
      providerOffer: {
        id: l.providerOffer.id,
        providerSku: l.providerOffer.providerSku,
        rawName: l.providerOffer.rawName,
        rawNameEn: l.providerOffer.rawNameEn,
        costMinor: l.providerOffer.costMinor.toString(),
        currency: l.providerOffer.currency,
        availability: l.providerOffer.availability,
        stockQuantity: l.providerOffer.stockQuantity,
        customerInputType: l.providerOffer.customerInputType,
        customerPrompt: l.providerOffer.customerPrompt,
        rawWarranty: l.providerOffer.rawWarranty,
        rawDescription: l.providerOffer.rawDescription,
        lastSyncedAt: l.providerOffer.lastSyncedAt.toISOString(),
        provider: {
          code: l.providerOffer.provider.code,
          displayName: l.providerOffer.provider.displayName,
        },
      },
    })),
  }));

  const serializedPool: SerializedProviderOffer[] = rawPool.map((po) => ({
    id: po.id,
    providerSku: po.providerSku,
    rawName: po.rawName,
    rawNameEn: po.rawNameEn,
    costMinor: po.costMinor.toString(),
    currency: po.currency,
    availability: po.availability,
    stockQuantity: po.stockQuantity,
    customerInputType: po.customerInputType,
    customerPrompt: po.customerPrompt,
    rawWarranty: po.rawWarranty,
    rawDescription: po.rawDescription,
    lastSyncedAt: po.lastSyncedAt.toISOString(),
    provider: {
      code: po.provider.code,
      displayName: po.provider.displayName,
    },
  }));

  return (
    <OfferStudio
      productId={product.id}
      productNameEn={product.nameEn}
      productSlug={product.slug}
      locale={locale}
      offers={serializedOffers}
      pool={serializedPool}
      providers={rawProviders}
      initialQuery={q}
      initialProvider={provider}
    />
  );
}
