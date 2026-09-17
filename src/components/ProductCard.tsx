import Link from "next/link";
import type { Locale } from "@/i18n";
import type { CatalogProduct } from "@/lib/catalog";
import { ProductArt } from "@/lib/product-images";
import { Price } from "./Price";

export default function ProductCard({ p, locale, index = 0 }: { p: CatalogProduct; locale: Locale; index?: number }) {
  const cheapest = [...p.offers].sort((a, b) => a.price - b.price)[0];
  const hasDiscount = cheapest.compareAt != null && cheapest.compareAt > cheapest.price;
  const discountPct = hasDiscount ? Math.round(((cheapest.compareAt! - cheapest.price) / cheapest.compareAt!) * 100) : 0;

  return (
    <Link
      href={`/${locale}/products/${p.slug}`}
      data-index={String(index % 6)}
      className="reveal group relative flex flex-col overflow-hidden rounded-[1.75rem] bg-[var(--surface)] shadow-[var(--elev-1)] ring-1 ring-black/[0.04] dark:ring-white/10 transition-all duration-700 ease-[var(--ease-premium)] hover:-translate-y-1 hover:shadow-[var(--elev-2)] hover:ring-black/[0.06] dark:ring-white/10"
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[1.75rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]" />

      {(hasDiscount || p.isNew) && (
        <div className="absolute right-3 top-3 z-10 flex gap-1.5">
          {p.isNew && (
            <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold tracking-wide text-white shadow-sm">NEW</span>
          )}
          {hasDiscount && (
            <span className="rounded-full bg-[var(--discount)] px-2.5 py-1 text-[11px] font-bold tracking-wide text-white shadow-sm">
              −{discountPct}%
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-[var(--surface-2)] p-1 ring-1 ring-black/[0.04] dark:ring-white/10">
            <ProductArt id={p.image} size={52} />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-black/[0.06] dark:border-white/[0.09] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium tracking-tight text-[var(--fg-muted)] shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            {p.sold.toLocaleString()} sold
          </span>
        </div>

        <div className="min-h-[60px]">
          <h3 className="line-clamp-1 text-[15px] font-semibold leading-5 tracking-tight">{p.name}</h3>
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-[var(--fg-muted)]">{p.description}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {p.offers.slice(0, 3).map((o) => (
            <span
              key={o.id}
              className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium tracking-tight text-[var(--fg-muted)] ring-1 ring-black/[0.04] dark:ring-white/10"
            >
              {o.label[locale] ?? o.label.en}
            </span>
          ))}
          {p.offers.length > 3 && (
            <span className="rounded-full bg-[var(--fg)] px-2.5 py-1 text-xs font-semibold tracking-wide text-white">
              +{p.offers.length - 3}
            </span>
          )}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-black/[0.06] dark:border-white/[0.09] bg-[var(--surface-2)]/70 px-4 py-3.5">
        <Price cents={cheapest.price} locale={locale} compareAt={cheapest.compareAt} size="sm" />
        <span className="btn-shine btn-shine-group inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-xs font-bold tracking-wide text-[var(--accent-fg)] shadow-sm transition-all duration-300 ease-[var(--ease-premium)] group-hover:bg-[var(--accent-hover)] group-hover:shadow-md group-active:scale-[0.98]">
          View
          <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-[10px] transition-transform duration-300 ease-[var(--ease-premium)] group-hover:translate-x-0.5">↗</span>
        </span>
      </div>
    </Link>
  );
}
