"use client";

import { useState } from "react";
import Link from "next/link";
import { ProductArt } from "@/lib/product-images";
import BuyOfferForm from "@/components/BuyOfferForm";
import type { CatalogProduct } from "@/lib/catalog";
import type { Locale } from "@/i18n";

// Display mode for offer warranty: "card" (Option 1) | "accordion" (Option 2)
const WARRANTY_MODE = "card" as const;

export function ProductInteractiveLayout({
  product,
  locale,
  descriptionTitle,
  resellerTier,
  wholesalePrices,
  isLoggedIn = false,
}: {
  product: CatalogProduct;
  locale: Locale;
  descriptionTitle: string;
  resellerTier?: { id: string; name: string; discountPercent: number } | null;
  wholesalePrices?: Record<string, { price: number; marginCents: number }>;
  isLoggedIn?: boolean;
}) {
  const [selectedOfferId, setSelectedOfferId] = useState<string>(
    product.offers[0]?.id ?? ""
  );

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      {/* Left Column: Product Details, Description & Store Assurance */}
      <div className="flex flex-col justify-between rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)] sm:p-8">
        <div>
          <div className="flex items-start gap-4">
            <ProductArt id={product.image} size={72} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
              <p className="mt-2 text-sm leading-6 text-[var(--fg-muted)]">
                {product.description}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs font-medium text-[var(--fg-muted)]">
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                  {product.sold.toLocaleString()} sold
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 capitalize">
                  {product.category}
                </span>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="mt-8">
            <h2 className="text-sm font-semibold">{descriptionTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--fg-muted)]">
              {product.description} Delivered instantly after payment. Check your order code at Track Order.
            </p>
          </div>

          {/* Store Peace of Mind & Guarantees */}
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-4 sm:p-5">
            <div className="flex items-center gap-2 font-bold text-[var(--fg)]">
              <span className="text-base" aria-hidden>🛡️</span>
              <span className="text-sm font-bold">
                {locale === "ar"
                  ? "ضمانات متجر رقمي"
                  : locale === "fr"
                    ? "Engagements & Garanties Raqmi"
                    : "Raqmi Store Guarantees"}
              </span>
            </div>
            <ul className="mt-3 space-y-2 text-xs text-[var(--fg-muted)]">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                <span>
                  {locale === "ar"
                    ? "تراخيص واشتراكات رقمية رسمية 100% بدون أي انقطاعات غير مصرح بها."
                    : locale === "fr"
                      ? "Abonnements et licences 100% officiels avec transparence complète."
                      : "100% official digital subscriptions and licenses with complete transparency."}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                <span>
                  {locale === "ar"
                    ? "ضمان الاستبدال الفوري عبر صفحة تتبع الطلب في حال واجهتك أي مشكلة."
                    : locale === "fr"
                      ? "Garantie de remplacement immédiat via le suivi de commande en cas de problème."
                      : "Immediate replacement guarantee via Track Order if you face any issues."}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                <span>
                  {locale === "ar"
                    ? "تعامل مالي شرعي وشفاف وفق عقد وكالة بأجرة محددة ومعلنة."
                    : locale === "fr"
                      ? "Courtage islamique transparent avec honoraires de mandat clairement affichés."
                      : "Transparent Islamic agency (Tawkeel) with upfront brokerage fee."}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Right Column: Variant Selector & Purchase Box */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)]">
        <BuyOfferForm
          offers={product.offers}
          locale={locale}
          slug={product.slug}
          resellerTier={resellerTier}
          wholesalePrices={wholesalePrices}
          selectedOfferId={selectedOfferId}
          onSelectOffer={setSelectedOfferId}
          isLoggedIn={isLoggedIn}
          warrantyMode={WARRANTY_MODE}
        />

        <div className="mt-6 rounded-2xl bg-[var(--surface-2)] p-4">
          <p className="text-xs font-semibold">Need help?</p>
          <p className="mt-1 text-xs leading-5 text-[var(--fg-muted)]">
            Check{" "}
            <Link
              href={`/${locale}/track-order`}
              className="font-semibold text-[var(--accent)] hover:underline"
            >
              Track Order
            </Link>{" "}
            with your code, or message us on Telegram.
          </p>
        </div>
      </div>
    </div>
  );
}

