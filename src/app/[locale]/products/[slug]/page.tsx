import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getProductBySlug } from "@/lib/catalog";
import { ProductArt } from "@/lib/product-images";
import BuyOfferForm from "@/components/BuyOfferForm";
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
  const loc = locale as Locale;
  const p = await getProductBySlug(slug, loc);
  if (!p) notFound();

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
          <BuyOfferForm offers={p.offers} locale={loc} />

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
