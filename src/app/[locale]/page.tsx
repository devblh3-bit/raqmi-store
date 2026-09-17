import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import CategoryPills from "@/components/CategoryPills";
import ProductCard from "@/components/ProductCard";
import SectionHeader from "@/components/SectionHeader";
import { products } from "@/data/catalog";
import type { Locale } from "@/i18n";
import Reveal from "@/components/Reveal";

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
      <section className="mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
        <Reveal>
          <div className="overflow-hidden rounded-[2rem] border border-black/[0.06] dark:border-white/[0.09] bg-[var(--surface)] shadow-[var(--elev-2)]">
            <div className="px-6 py-10 text-center sm:px-10 sm:py-14">
              <p className="mx-auto inline-flex items-center gap-2 rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold tracking-wide text-[var(--fg-muted)] ring-1 ring-black/[0.04] dark:ring-white/10">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" aria-hidden />
                Premium licenses · Instant delivery · Trusted by 12k+
              </p>
              <h1 className="mx-auto mt-5 max-w-3xl text-balance text-[2rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-5xl md:text-[3.25rem]">
                {t("heroTitle")}
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-balance text-sm leading-6 text-[var(--fg-muted)] sm:text-base sm:leading-7">
                {t("heroSubtitle")}
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link
                  href={`/${locale}/products`}
                  className="btn-shine group inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-7 py-3.5 text-sm font-bold tracking-tight text-[var(--accent-fg)] shadow-[var(--elev-1)] transition-all duration-300 ease-[var(--ease-premium)] hover:bg-[var(--accent-hover)] hover:shadow-md active:scale-[0.98]"
                >
                  {t("exploreCategories")}
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-xs transition-transform duration-300 ease-[var(--ease-premium)] group-hover:translate-x-0.5">→</span>
                </Link>
                <Link
                  href={`/${locale}/promo`}
                  className="mat-func group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold tracking-tight text-[var(--fg)] shadow-[var(--elev-1)] transition-all duration-300 ease-[var(--ease-premium)] hover:shadow-md active:scale-[0.98]"
                >
                  View promo <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] text-xs transition-transform duration-300 ease-[var(--ease-premium)] group-hover:translate-x-0.5">→</span>
                </Link>
              </div>

              <form action={`/${locale}/products`} className="mx-auto mt-8 flex max-w-xl gap-2 rounded-full bg-[var(--surface-2)] p-1.5 shadow-[inset_0_0_0_1px_var(--border)]">
                <input
                  name="q"
                  placeholder={t("searchPlaceholder")}
                  className="h-10 flex-1 rounded-full bg-[var(--surface)] px-5 text-sm font-medium tracking-tight outline-none placeholder:text-[var(--fg-faint)] focus:ring-2 focus:ring-[var(--ring)]"
                />
                <button className="btn-shine group inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-6 text-sm font-bold tracking-tight text-[var(--accent-fg)] shadow-sm transition-all duration-300 ease-[var(--ease-premium)] hover:bg-[var(--accent-hover)] active:scale-[0.98]">
                  Search
                </button>
              </form>

              <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs font-medium tracking-tight text-[var(--fg-faint)]">
                <span>Trusted checkout</span>
                <span aria-hidden>·</span>
                <span>Instant email delivery</span>
                <span aria-hidden>·</span>
                <span>Telegram support</span>
              </div>
            </div>

            <div className="border-t border-black/[0.06] dark:border-white/[0.09] bg-[var(--surface-2)]/60 px-6 py-4 sm:px-8">
              <CategoryPills locale={loc} />
            </div>
          </div>
        </Reveal>
      </section>

      <Reveal>
        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <SectionHeader title={t("featured")} href={`/${locale}/products`} cta={t("viewAll")} />
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p, i) => (
              <ProductCard key={p.slug} p={p} locale={loc} index={i} />
            ))}
          </div>
        </section>
      </Reveal>

      {newArrivals.length > 0 && (
        <Reveal>
          <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            <SectionHeader title={t("newArrivals")} subtitle="Just added by our curators" />
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {newArrivals.map((p, i) => (
                <ProductCard key={p.slug} p={p} locale={loc} index={i} />
              ))}
            </div>
          </section>
        </Reveal>
      )}

      <Reveal>
        <section className="mx-auto max-w-6xl px-4 pb-12 pt-4 sm:px-6">
          <SectionHeader title={c("allProducts")} href={`/${locale}/products`} cta={t("viewAll")} />
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((p, i) => (
              <ProductCard key={p.slug} p={p} locale={loc} index={i} />
            ))}
          </div>
          <p className="mt-6 text-center text-xs tracking-wide text-[var(--fg-faint)]">
            Prices show USD + indicative DZD. Final charge in USD.
          </p>
        </section>
      </Reveal>
    </div>
  );
}
