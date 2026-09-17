import Link from "next/link";
import type { Locale } from "@/i18n";
import type { Product } from "@/data/catalog";
import { ProductArt } from "@/lib/product-images";
import { Price } from "./Price";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="text-amber-500" aria-hidden>
        ★
      </span>
      <span className="text-xs font-semibold tabular-nums">{rating.toFixed(1)}</span>
    </span>
  );
}

export default function ProductCard({ p, locale }: { p: Product; locale: Locale }) {
  const cheapest = [...p.offers].sort((a, b) => a.price - b.price)[0];
  const hasDiscount = cheapest.compareAt && cheapest.compareAt > cheapest.price;
  const discountPct = hasDiscount ? Math.round(((cheapest.compareAt! - cheapest.price) / cheapest.compareAt!) * 100) : 0;

  return (
    <Link
      href={`/${locale}/products/${p.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-[var(--elev-1)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--elev-2)]"
    >
      {hasDiscount && (
        <span className="absolute right-3 top-3 z-10 rounded-full bg-[var(--discount)] px-2.5 py-1 text-[11px] font-bold tracking-wide text-white">
          -{discountPct}%
        </span>
      )}
      {p.isNew && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold tracking-wide text-white">
          NEW
        </span>
      )}
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <ProductArt id={p.image} size={52} />
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--fg-muted)]">
            <Stars rating={p.rating} />
            <span className="text-[var(--fg-faint)]">· {p.reviews.toLocaleString()}</span>
          </span>
        </div>
        <div className="min-h-[56px]">
          <h3 className="line-clamp-1 text-[15px] font-semibold tracking-tight">{p.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--fg-muted)]">{p.description}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {p.offers.slice(0, 3).map((o) => (
            <span
              key={o.id}
              className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--fg-muted)]"
            >
              {o.label[locale] ?? o.label.en}
            </span>
          ))}
          {p.offers.length > 3 && (
            <span className="rounded-full bg-[var(--fg)] px-2.5 py-1 text-xs font-semibold text-white">+{p.offers.length - 3}</span>
          )}
        </div>
      </div>
      <div className="mt-auto border-t border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <Price cents={cheapest.price} locale={locale} compareAt={cheapest.compareAt} size="sm" />
          <span className="shrink-0 rounded-full bg-[var(--fg)] px-3 py-1.5 text-xs font-semibold text-white transition-colors group-hover:bg-black">
            View
          </span>
        </div>
      </div>
    </Link>
  );
}
