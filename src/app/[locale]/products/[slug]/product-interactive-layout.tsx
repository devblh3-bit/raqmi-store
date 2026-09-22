"use client";

import { useState } from "react";
import Link from "next/link";
import { ProductArt } from "@/lib/product-images";
import BuyOfferForm from "@/components/BuyOfferForm";
import type { CatalogProduct } from "@/lib/catalog";
import type { Locale } from "@/i18n";

export function ProductInteractiveLayout({
  product,
  locale,
  descriptionTitle,
  resellerTier,
  wholesalePrices,
}: {
  product: CatalogProduct;
  locale: Locale;
  descriptionTitle: string;
  resellerTier?: { id: string; name: string; discountPercent: number } | null;
  wholesalePrices?: Record<string, { price: number; marginCents: number }>;
}) {
  const [selectedOfferId, setSelectedOfferId] = useState<string>(
    product.offers[0]?.id ?? ""
  );

  const selectedOffer =
    product.offers.find((o) => o.id === selectedOfferId) ?? product.offers[0];

  const defaultWarranty =
    locale === "ar"
      ? "ضمان استبدال كامل طوال فترة الاشتراك. تسليم فوري وتلقائي مع دعم فني متواصل على مدار الساعة."
      : locale === "fr"
        ? "Garantie de remplacement complet pendant la durée de l'abonnement. Livraison instantanée avec assistance technique 24/7."
        : "Full replacement guarantee during the subscription period. Fast automated delivery and 24/7 technical support.";

  const warrantyTitle =
    locale === "ar"
      ? "تفاصيل الضمان والتعليمات:"
      : locale === "fr"
        ? "Garantie & Instructions :"
        : "Warranty & Instructions:";

  // Check if current variant has custom rules, fallback to any variant with rules, or default guarantee
  const currentRules =
    selectedOffer?.rules && (selectedOffer.rules[locale] || selectedOffer.rules.en);
  const anyRules = product.offers
    .map((o) => o.rules?.[locale] || o.rules?.en)
    .find((r) => !!r && r.trim().length > 0);

  const warrantyText = (currentRules?.trim() || anyRules?.trim() || defaultWarranty).trim();

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      {/* Left Column: Product Details, Description & Warranty */}
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

          {/* Under the description: 🛡️ Warranty & Instructions */}
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-4 sm:p-5">
            <div className="flex items-center gap-2 font-bold text-[var(--fg)]">
              <span className="text-base" aria-hidden>🛡️</span>
              <span className="text-sm font-bold">
                {warrantyTitle}
              </span>
            </div>
            <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-[var(--fg-muted)] whitespace-pre-line">
              {warrantyText}
            </p>
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
