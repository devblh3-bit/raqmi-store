import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import CategoryPills from "@/components/CategoryPills";
import ProductCard from "@/components/ProductCard";
import SectionHeader from "@/components/SectionHeader";
import { products } from "@/data/catalog";
import type { Locale } from "@/i18n";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "home" });
  const c = await getTranslations({ locale, namespace: "catalog" });
  const loc = locale as Locale;

  const featured = products.filter((p) => p.isFeatured);
  const newArrivals = products.filter((p) => p.isNew);
  const rest = products.filter((p) => !p.isFeatured && !p.isNew);

  return (
    <div className="ambient-bg">
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
        <div className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[var(--elev-2)] sm:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold tracking-wide text-[var(--fg-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> Premium licenses · Instant delivery
            </p>
            <h1 className="mt-4 text-balance text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
              {t("heroTitle")}
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-balance text-sm leading-6 text-[var(--fg-muted)] sm:text-base sm:leading-7">
              {t("heroSubtitle")}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href={`/${locale}/products`}
                className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[var(--accent-hover)]"
              >
                {t("exploreCategories")} →
              </Link>
              <Link
                href={`/${locale}/promo`}
                className="rounded-full border border-[var(--border)] bg-white px-6 py-3 text-sm font-semibold shadow-sm transition-all hover:shadow-md"
              >
                View promo 🔥
              </Link>
            </div>

            {/* Search */}
            <form action={`/${locale}/products`} className="mx-auto mt-6 flex max-w-xl gap-2">
              <input
                name="q"
                placeholder={t("searchPlaceholder")}
                className="h-11 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-5 text-sm outline-none placeholder:text-[var(--fg-faint)] focus:border-[var(--accent)] focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              />
              <button className="h-11 shrink-0 rounded-full bg-[var(--fg)] px-6 text-sm font-semibold text-white transition-colors hover:bg-black">
                Search
              </button>
            </form>
          </div>

          {/* Category pills */}
          <div className="mt-8">
            <CategoryPills locale={loc} />
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <SectionHeader title={t("featured")} href={`/${locale}/products`} cta={t("viewAll")} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p) => (
            <ProductCard key={p.slug} p={p} locale={loc} />
          ))}
        </div>
      </section>

      {/* New arrivals */}
      {newArrivals.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <SectionHeader title={t("newArrivals")} subtitle="Just added by our curators" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {newArrivals.map((p) => (
              <ProductCard key={p.slug} p={p} locale={loc} />
            ))}
          </div>
        </section>
      )}

      {/* All products */}
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-2 sm:px-6">
        <SectionHeader title={c("allProducts")} href={`/${locale}/products`} cta={t("viewAll")} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((p) => (
            <ProductCard key={p.slug} p={p} locale={loc} />
          ))}
        </div>
      </section>
    </div>
  );
}
