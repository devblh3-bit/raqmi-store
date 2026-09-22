"use client";

import { useActionState, useState } from "react";
import { useCart } from "./CartProvider";
import { useTranslations } from "next-intl";
import { buyNow, type BuyState } from "@/app/actions/buy";
import type { CatalogOffer } from "@/lib/catalog";
import type { Locale } from "@/i18n";
import { Price, PriceCompact } from "./Price";

const ERROR_KEY: Record<string, string> = {
  INSUFFICIENT_FUNDS: "errorFunds",
  OFFER_UNAVAILABLE: "errorUnavailable",
  INPUT_REQUIRED: "errorInputRequired",
  MAINTENANCE_MODE: "errorMaintenance",
  BAD_QUANTITY: "errorGeneric",
  EMPTY_CART: "errorGeneric",
  BAD_REQUEST: "errorGeneric",
  UNKNOWN: "errorGeneric",
};

export default function BuyOfferForm({
  offers,
  locale,
  slug,
  resellerTier,
  wholesalePrices,
}: {
  offers: CatalogOffer[];
  locale: Locale;
  slug: string;
  resellerTier?: { id: string; name: string; discountPercent: number } | null;
  wholesalePrices?: Record<string, { price: number; marginCents: number }>;
}) {
  const t = useTranslations("product");
  const tc = useTranslations("checkout");
  const { addItem } = useCart();
  const [selected, setSelected] = useState(offers[0]?.id ?? "");
  const [customerInput, setCustomerInput] = useState("");
  const [state, action, pending] = useActionState<BuyState, FormData>(buyNow, {});

  const offer = offers.find((o) => o.id === selected) ?? offers[0];
  const selectedOfferId = offer?.id ?? "";
  const errorKey = state.error ? (ERROR_KEY[state.error] ?? "errorGeneric") : null;

  return (
    <form action={action}>
      <input type="hidden" name="locale" value={locale} />
      {/* Where to come back to after signing in. Validated server-side. */}
      <input type="hidden" name="returnTo" value={`/${locale}/products/${slug}`} />
      <input type="hidden" name="offerId" value={selectedOfferId} />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("chooseOffer")}</h2>
        {resellerTier && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            ⭐ {resellerTier.name} ({resellerTier.discountPercent}% Off)
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {offers.map((o) => {
          const wp = wholesalePrices?.[o.id];
          return (
            <label
              key={o.id}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 transition-colors hover:border-[var(--border-strong)] has-[input:checked]:border-[var(--accent)] has-[input:checked]:bg-[var(--accent-soft)]"
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="offerChoice"
                  value={o.id}
                  checked={selected === o.id}
                  onChange={() => setSelected(o.id)}
                  className="accent-[var(--accent)]"
                />
                <span className="text-sm font-semibold">{o.label[locale] ?? o.label.en}</span>
                {o.badge && (
                  <span className="rounded-full bg-[var(--discount)] px-2 py-0.5 text-[11px] font-bold text-white">
                    {o.badge}
                  </span>
                )}
                {o.stock !== undefined && o.stock <= 5 && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
                    {t("stockLimited")}: {o.stock}
                  </span>
                )}
              </span>
              <span className="text-sm font-bold">
                {wp ? (
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[var(--fg-muted)] line-through">
                        <PriceCompact cents={o.price} locale={locale} />
                      </span>
                      <Price cents={wp.price} locale={locale} size="sm" />
                    </div>
                    {wp.marginCents > 0 && (
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Wholesale Rate
                      </span>
                    )}
                  </div>
                ) : (
                  <Price cents={o.price} locale={locale} compareAt={o.compareAt} size="sm" />
                )}
              </span>
            </label>
          );
        })}
      </div>

      {/* Localized offer rules and warranty instructions */}
      {offer?.rules && (offer.rules[locale] || offer.rules.en) && (
        <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/70 p-3.5 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-[var(--fg)]">
            <span>🛡️</span>
            <span>
              {locale === "ar"
                ? "تفاصيل الضمان والتعليمات:"
                : locale === "fr"
                  ? "Garantie & Instructions :"
                  : "Warranty & Instructions:"}
            </span>
          </div>
          <p className="mt-1 leading-relaxed text-[var(--fg-muted)] whitespace-pre-line">
            {offer.rules[locale] || offer.rules.en}
          </p>
        </div>
      )}

      {offer?.requiresCustomerInput && (
        <div className="mt-4">
          <label htmlFor="customerInput" className="block text-sm font-semibold">
            {tc("customerInput")}
          </label>
          <input
            id="customerInput"
            name="customerInput"
            required
            value={customerInput}
            onChange={(event) => setCustomerInput(event.target.value)}
            maxLength={500}
            placeholder={offer.customerPrompt ?? "you@example.com"}
            className="mt-2 h-11 w-full rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-5 text-sm outline-none focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
      )}

      {errorKey && (
        <p
          role="alert"
          className="mt-4 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {tc(errorKey)}
        </p>
      )}

      <button
        type="button"
        disabled={!offer}
        onClick={() => {
          if (!offer) return;
          addItem({
            offerId: offer.id,
            label: offer.label[locale] ?? offer.label.en,
            price: offer.price,
            locale,
            requiresCustomerInput: offer.requiresCustomerInput,
            customerPrompt: offer.customerPrompt,
            customerInput: customerInput.trim() || undefined,
          });
        }}
        className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] text-sm font-bold text-[var(--fg)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
      >
        {t("addToCart")}
      </button>

      <button
        disabled={pending || !offers.length}
        className="btn-shine group mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] text-sm font-bold tracking-tight text-[var(--accent-fg)] shadow-sm transition-all duration-300 ease-[var(--ease-premium)] hover:bg-[var(--accent-hover)] hover:shadow-md active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? tc("placing") : t("buyNow")}
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-xs transition-transform duration-300 ease-[var(--ease-premium)] group-hover:translate-x-0.5"
        >
          →
        </span>
      </button>
    </form>
  );
}
