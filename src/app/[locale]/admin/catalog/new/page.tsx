import { prisma } from "@/lib/db";
import { NewProductForm } from "./new-product-form";

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [categories, unlinkedOffersRaw] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }],
      select: { id: true, slug: true, nameEn: true },
    }),
    prisma.providerOffer.findMany({
      where: { links: { none: {} } },
      orderBy: { lastSyncedAt: "desc" },
      select: {
        id: true,
        rawName: true,
        rawNameEn: true,
        providerSku: true,
        costMinor: true,
        currency: true,
        rawDescription: true,
        rawDescriptionEn: true,
        rawWarranty: true,
        provider: { select: { displayName: true } },
      },
      take: 50,
    }),
  ]);

  const supplierPool = unlinkedOffersRaw.map((o) => ({
    id: o.id,
    rawName: o.rawName,
    rawNameEn: o.rawNameEn,
    providerSku: o.providerSku,
    costMinor: o.costMinor.toString(),
    currency: o.currency,
    rawDescription: o.rawDescription,
    rawDescriptionEn: o.rawDescriptionEn,
    rawWarranty: o.rawWarranty,
    provider: o.provider,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fast Product Setup</h1>
        <p className="text-xs text-[var(--fg-muted)] mt-0.5">
          Create a new store product in 60 seconds with English-first input, auto-translations, and inline variant mapping.
        </p>
      </div>

      <NewProductForm categories={categories} supplierPool={supplierPool} locale={locale} />
    </div>
  );
}
