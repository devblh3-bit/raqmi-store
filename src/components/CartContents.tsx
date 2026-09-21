"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { buyNow, type BuyState } from "@/app/actions/buy";
import { useCart } from "@/components/CartProvider";
import { Price } from "@/components/Price";
import type { Locale } from "@/i18n";

const ERROR_KEY: Record<string, string> = {
  INSUFFICIENT_FUNDS: "errorFunds",
  OFFER_UNAVAILABLE: "errorUnavailable",
  INPUT_REQUIRED: "errorInputRequired",
  BAD_QUANTITY: "errorGeneric",
  EMPTY_CART: "errorGeneric",
  BAD_REQUEST: "errorGeneric",
  UNKNOWN: "errorGeneric",
};

export default function CartContents({ locale }: { locale: Locale }) {
  const { items, removeItem, updateInput } = useCart();
  const t = useTranslations("cart");
  const tc = useTranslations("checkout");
  const [state, action, pending] = useActionState<BuyState, FormData>(buyNow, {});
  const errorKey = state.error ? (ERROR_KEY[state.error] ?? "errorGeneric") : null;
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (!items.length) {
    return (
      <div className="mt-6 rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-10 text-center shadow-sm">
        <p className="text-sm font-medium text-[var(--fg-muted)]">{t("empty")}</p>
        <Link href={`/${locale}/products`} className="mt-4 inline-flex rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]">{tc("backToProducts")} →</Link>
      </div>
    );
  }

  const lines = items.map(({ offerId, quantity, customerInput }) => ({ offerId, quantity, customerInput }));
  const missingInput = items.some((item) => item.requiresCustomerInput && !item.customerInput?.trim());

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="returnTo" value={`/${locale}/cart`} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />

      {items.map((item) => (
        <article key={item.offerId} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--elev-1)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">{item.label}</h2>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">{item.quantity} × <Price cents={item.price} locale={locale} size="sm" /></p>
            </div>
            <button
              type="button"
              onClick={() => removeItem(item.offerId)}
              aria-label={`Remove ${item.label}`}
              className="text-sm font-semibold text-[var(--fg-muted)] hover:text-red-600"
            >
              ×
            </button>
          </div>
          {item.requiresCustomerInput && (
            <div className="mt-4">
              <label htmlFor={`cart-input-${item.offerId}`} className="block text-sm font-semibold">{tc("customerInput")}</label>
              <input
                id={`cart-input-${item.offerId}`}
                required
                value={item.customerInput ?? ""}
                onChange={(event) => updateInput(item.offerId, event.target.value)}
                maxLength={500}
                placeholder={item.customerPrompt ?? "you@example.com"}
                className="mt-2 h-11 w-full rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
          )}
        </article>
      ))}

      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--elev-1)]">
        <div className="flex items-center justify-between font-semibold"><span>{tc("total")}</span><Price cents={total} locale={locale} /></div>
        {errorKey && <p role="alert" className="mt-4 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{tc(errorKey)}</p>}
        <button disabled={pending || missingInput} className="btn-shine mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-[var(--accent-fg)] disabled:opacity-60">
          {pending ? tc("placing") : t("checkout")}
        </button>
      </div>
    </form>
  );
}
