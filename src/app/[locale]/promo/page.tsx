import { setRequestLocale } from "next-intl/server";
import ProductCard from "@/components/ProductCard";
import { getProducts } from "@/lib/catalog";
import type { Locale } from "@/i18n";
export default async function PromoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = locale as Locale;
  const products = await getProducts(loc);
  const promos = products.filter((p) => p.offers.some((o) => o.compareAt && o.compareAt > o.price));
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Promo 🔥</h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">{promos.length} products on sale</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {promos.map((p) => <ProductCard key={p.slug} p={p} locale={loc} />)}
      </div>
    </div>
  );
}
