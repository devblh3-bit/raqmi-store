import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getCategory, getProductsByCategory } from "@/lib/catalog";
import ProductCard from "@/components/ProductCard";
import type { Locale } from "@/i18n";
import Link from "next/link";
export default async function KategoriSlugPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const cat = await getCategory(slug);
  if (!cat) notFound();
  const loc = locale as Locale;
  const list = await getProductsByCategory(slug, loc);
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link href={`/${locale}/categories`} className="text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]">← Categories</Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">{cat.name[loc] ?? cat.name.en}</h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">{list.length} products</p>
      {list.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--fg-muted)]">No products in this category yet.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => <ProductCard key={p.slug} p={p} locale={loc} />)}
        </div>
      )}
    </div>
  );
}
