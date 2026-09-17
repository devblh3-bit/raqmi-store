import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { products } from "@/data/catalog";
import { ProductArt } from "@/lib/product-images";
import { Price } from "@/components/Price";
import type { Locale } from "@/i18n";
import Link from "next/link";

export default async function ProductDetail({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "product" });
  const p = products.find((x) => x.slug === slug);
  if (!p) notFound();
  const loc = locale as Locale;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link href={`/${locale}/products`} className="text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]">
        ← Back to products
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)] sm:p-8">
          <div className="flex items-start gap-4">
            <ProductArt id={p.image} size={72} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{p.name}</h1>
              <p className="mt-2 text-sm leading-6 text-[var(--fg-muted)]">{p.description}</p>
              <div className="mt-3 flex items-center gap-2 text-xs font-medium text-[var(--fg-muted)]">
                <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />{p.sold.toLocaleString()} sold</span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 capitalize">{p.category}</span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-sm font-semibold">{t("description")}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--fg-muted)]">
              {p.description} Delivered instantly after payment. Check your order code at Track Order.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)]">
          <h2 className="text-sm font-semibold">{t("chooseOffer")}</h2>
          <div className="mt-3 flex flex-col gap-2">
            {p.offers.map((o) => (
              <label
                key={o.id}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 transition-colors hover:border-[var(--border-strong)] has-[input:checked]:border-[var(--accent)] has-[input:checked]:bg-[var(--accent-soft)]"
              >
                <span className="flex items-center gap-3">
                  <input type="radio" name="offer" value={o.id} defaultChecked={o.id === p.offers[0].id} className="accent-[var(--accent)]" />
                  <span className="text-sm font-semibold">{o.label[loc] ?? o.label.en}</span>
                  {o.badge && (
                    <span className="rounded-full bg-[var(--discount)] px-2 py-0.5 text-[11px] font-bold text-white">{o.badge}</span>
                  )}
                  {o.stock !== undefined && o.stock <= 5 && (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
                      Stock: {o.stock}
                    </span>
                  )}
                </span>
                <span className="text-sm font-bold">
                  <Price cents={o.price} locale={loc} compareAt={o.compareAt} size="sm" />
                </span>
              </label>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Link
              href={`/${locale}/track-order`}
              className="btn-shine group inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-bold tracking-tight text-[var(--accent-fg)] shadow-sm transition-all duration-300 ease-[var(--ease-premium)] hover:bg-[var(--accent-hover)] hover:shadow-md active:scale-[0.98]"
            >
              {t("buyNow")}
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-xs transition-transform duration-300 ease-[var(--ease-premium)] group-hover:translate-x-0.5">→</span>
            </Link>
            <button className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-6 text-sm font-semibold shadow-sm transition-all hover:shadow-md">
              {t("addToCart")}
            </button>
            <p className="text-center text-xs text-[var(--fg-faint)]">Checkout is mock for now — wallet + provider wiring next.</p>
          </div>

          <div className="mt-6 rounded-2xl bg-[var(--surface-2)] p-4">
            <p className="text-xs font-semibold">Need help?</p>
            <p className="mt-1 text-xs leading-5 text-[var(--fg-muted)]">
              Check <Link href={`/${locale}/track-order`} className="font-semibold text-[var(--accent)] hover:underline">Track Order</Link> with your code, or message us on Telegram.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
