import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { getCategories } from "@/lib/catalog";
import type { Locale } from "@/i18n";

export default async function KategoriPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = locale as Locale;
  const categories = await getCategories();
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">{categories.length} categories</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => {
          const count = c.count;
          return (
            <Link key={c.slug} href={`/${locale}/categories/${c.slug}`} className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <span className="text-sm font-semibold">{c.name[loc] ?? c.name.en}</span>
              <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--fg-muted)]">{count} items</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
