import { setRequestLocale, getTranslations } from "next-intl/server";
import ProductCard from "@/components/ProductCard";
import { getProducts } from "@/lib/catalog";
import type { Locale } from "@/i18n";

export default async function AplikasiPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; urutkan?: string }>;
}) {
  const { locale } = await params;
  const { q, urutkan } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "home" });
  const loc = locale as Locale;

  let list = await getProducts(loc);
  if (q) {
    const needle = q.trim().toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.description.toLowerCase().includes(needle) ||
        p.slug.toLowerCase().includes(needle) ||
        p.category.toLowerCase().includes(needle) ||
        p.offers.some((o) => (o.label[loc] ?? o.label.en ?? "").toLowerCase().includes(needle))
    );
  }
  if (urutkan === "termurah") list.sort((a, b) => Math.min(...a.offers.map((o) => o.price)) - Math.min(...b.offers.map((o) => o.price)));
  if (urutkan === "termahal") list.sort((a, b) => Math.min(...b.offers.map((o) => o.price)) - Math.min(...a.offers.map((o) => o.price)));
  if (urutkan === "terbaru") list.sort((a, b) => (a.isNew === b.isNew ? 0 : a.isNew ? -1 : 1));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            {q ? `Search: “${q}” · ${list.length} results` : `${list.length} products · ${t("searchPlaceholder")}`}
          </p>
        </div>
        <form method="GET" className="flex flex-wrap items-center gap-2">
          <div className="relative flex items-center">
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder={t("searchPlaceholder") ?? "Search products..."}
              className="h-9 w-44 sm:w-60 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-medium outline-none focus:border-[var(--accent)]"
            />
            {q && (
              <a
                href={`/${locale}/products`}
                className="absolute right-3 text-xs font-bold text-[var(--fg-muted)] hover:text-[var(--fg)]"
                title="Clear search"
              >
                ✕
              </a>
            )}
          </div>
          <select
            name="urutkan"
            defaultValue={urutkan ?? "terbaru"}
            className="h-9 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium outline-none focus:border-[var(--accent)]"
          >
            <option value="terbaru">Newest</option>
            <option value="termurah">Cheapest</option>
            <option value="termahal">Most expensive</option>
          </select>
          <button type="submit" className="h-9 rounded-full bg-[var(--accent)] px-4 text-xs font-bold text-white shadow-xs hover:bg-[var(--accent-hover)] transition">
            Filter
          </button>
        </form>
      </div>
      {list.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--fg-muted)]">
          No products found for “{q}”.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p, i) => (
            <ProductCard key={p.slug} p={p} locale={loc} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
