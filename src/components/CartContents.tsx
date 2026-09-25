"use client";

import { useActionState, useState } from "react";
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

export default function CartContents({
  locale,
  isLoggedIn = false,
}: {
  locale: Locale;
  isLoggedIn?: boolean;
}) {
  const { items, removeItem, updateInput } = useCart();
  const t = useTranslations("cart");
  const tc = useTranslations("checkout");
  const [guestEmail, setGuestEmail] = useState("");
  const [state, action, pending] = useActionState<BuyState, FormData>(buyNow, {});
  const errorKey = state.error ? (ERROR_KEY[state.error] ?? "errorGeneric") : null;
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalBaseCost = items.reduce(
    (sum, item) => sum + (item.baseCost ?? item.price) * item.quantity,
    0,
  );
  const totalAgencyFee = Math.max(0, total - totalBaseCost);

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
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--fg-muted)]">
                <span>{item.quantity} × <Price cents={item.price} locale={locale} size="sm" /></span>
                {item.baseCost !== undefined && item.baseCost > 0 && item.price > item.baseCost && (
                  <div
                    className="group/pill relative inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hover:opacity-90 cursor-help"
                    tabIndex={0}
                    aria-label={`${tc("baseCost")}: ${(item.baseCost / 100).toFixed(2)} + ${tc("agencyFee")}: ${((item.price - item.baseCost) / 100).toFixed(2)}`}
                  >
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500/80 shrink-0" />
                    <span>{tc("agencyNoticeBadge")}</span>
                    <div className="pointer-events-none absolute bottom-full start-0 mb-1.5 hidden w-48 rounded-xl bg-[var(--surface)] p-2 text-[11px] shadow-lg border border-[var(--border)] text-[var(--fg)] group-hover/pill:block group-focus/pill:block z-20 text-start">
                      <div className="flex justify-between py-0.5">
                        <span className="text-[var(--fg-muted)]">{tc("baseCost")}:</span>
                        <span className="font-semibold"><Price cents={item.baseCost} locale={locale} size="sm" /></span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-[var(--fg-muted)]">{tc("agencyFee")}:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400"><Price cents={Math.max(0, item.price - item.baseCost)} locale={locale} size="sm" /></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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

      {!isLoggedIn && (
        <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--elev-1)]">
          <label htmlFor="cart-guest-email" className="block text-sm font-semibold">
            {locale === "ar"
              ? "البريد الإلكتروني لحسابك وإيصال الطلب"
              : locale === "fr"
                ? "Votre adresse e-mail (accès compte & reçu)"
                : "Your Email Address (account access & receipt)"}
          </label>
          <input
            id="cart-guest-email"
            name="email"
            type="email"
            required
            value={guestEmail}
            onChange={(event) => setGuestEmail(event.target.value)}
            maxLength={254}
            placeholder="you@example.com"
            className="mt-2 h-11 w-full rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
          />
          <p className="mt-1.5 text-[11px] text-[var(--fg-muted)]">
            {tc("guestEmailNotice")}
          </p>
        </article>
      )}

      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--elev-1)]">
        <div className="flex items-center justify-between font-semibold"><span>{tc("total")}</span><Price cents={total} locale={locale} /></div>

        {totalAgencyFee > 0 && (
          <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-[var(--fg-muted)]">
              <span className="flex items-center gap-1.5">
                <span>{tc("baseCost")}</span>
                <span
                  className="group relative inline-flex cursor-help text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  tabIndex={0}
                  aria-label={tc("wholesaleBaseTooltip")}
                >
                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--surface-3)] text-[9px] font-bold">?</span>
                  <span className="pointer-events-none absolute bottom-full start-0 mb-1.5 hidden w-52 rounded-xl bg-[var(--surface)] p-2 text-[11px] shadow-lg border border-[var(--border)] text-[var(--fg)] group-hover:block group-focus:block z-20">
                    {tc("wholesaleBaseTooltip")}
                  </span>
                </span>
              </span>
              <span className="font-medium text-[var(--fg)]">
                <Price cents={totalBaseCost} locale={locale} size="sm" />
              </span>
            </div>
            <div className="flex items-center justify-between text-[var(--fg-muted)]">
              <span className="flex items-center gap-1.5">
                <span>{tc("agencyFee")}</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  {locale === "ar" ? "أجرة الوكالة" : "Brokerage"}
                </span>
                <span
                  className="group relative inline-flex cursor-help text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  tabIndex={0}
                  aria-label={tc("agencyFeeTooltip")}
                >
                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--surface-3)] text-[9px] font-bold">?</span>
                  <span className="pointer-events-none absolute bottom-full start-0 mb-1.5 hidden w-52 rounded-xl bg-[var(--surface)] p-2 text-[11px] shadow-lg border border-[var(--border)] text-[var(--fg)] group-hover:block group-focus:block z-20">
                    {tc("agencyFeeTooltip")}
                  </span>
                </span>
              </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                <Price cents={totalAgencyFee} locale={locale} size="sm" />
              </span>
            </div>
            <div className="border-t border-[var(--border)] pt-1.5 flex items-center justify-between font-bold text-[var(--fg)]">
              <span>{tc("totalAuthorized")}</span>
              <Price cents={total} locale={locale} size="sm" />
            </div>
          </div>
        )}
        {state.error === "INSUFFICIENT_FUNDS" ? (
          <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold text-xs">
              <span>⚠️</span>
              <span>{tc("errorFunds")}</span>
            </div>
            <p className="text-xs text-[var(--fg-muted)]">
              {locale === "ar"
                ? "رصيد محفظتك غير كافٍ لإتمام طلبات السلة. اشحن محفظتك للمتابعة فوراً."
                : locale === "fr"
                  ? "Solde insuffisant pour commander votre panier. Rechargez votre portefeuille pour continuer."
                  : "Your wallet balance is insufficient to checkout. Top up via Baridimob or Crypto to complete it immediately."}
            </p>
            <a
              href={`/${locale}/account/wallet?amount=${(total / 100).toFixed(2)}&method=MANUAL_BANK`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 w-full shadow-sm transition-all"
            >
              <span>⚡</span>
              <span>
                {locale === "ar"
                  ? `شحن المحفظة (${(total / 100).toFixed(2)}$) عبر بريديموب ➔`
                  : locale === "fr"
                    ? `Recharger (${(total / 100).toFixed(2)}$) via BaridiMob ➔`
                    : `Top up Wallet ($${(total / 100).toFixed(2)}) via Baridimob ➔`}
              </span>
            </a>
          </div>
        ) : (
          errorKey && (
            <p role="alert" className="mt-4 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {tc(errorKey)}
            </p>
          )
        )}

        <div className="mt-4 rounded-xl bg-[var(--surface-2)]/40 border border-[var(--border)]/60 p-3 text-[11px] leading-relaxed text-[var(--fg-muted)]">
          <span>📜 {tc("tawkeelDeclaration")}{" "}</span>
          <Link
            href={`/${locale}/terms`}
            className="font-semibold text-[var(--accent)] underline underline-offset-2 hover:opacity-80"
            target="_blank"
          >
            {tc("termsLink")}
          </Link>
          .
        </div>
        <button
          disabled={pending || missingInput || (!isLoggedIn && !guestEmail.trim())}
          className="btn-shine mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-[var(--accent-fg)] disabled:opacity-60"
        >
          {pending ? tc("placing") : tc("agencyProcure")}
        </button>
      </div>
    </form>
  );
}
