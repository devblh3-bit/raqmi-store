"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { useTranslations } from "next-intl";
import { buyNow, type BuyState } from "@/app/actions/buy";
import type { CatalogOffer } from "@/lib/catalog";
import type { Locale } from "@/i18n";
import { Price, PriceCompact } from "./Price";
import { formatVariantTitle } from "@/lib/variant-formatter";
import { CardWarrantyAccordion, OfferWarranty, type WarrantyDisplayMode } from "./OfferWarranty";

export type ExtendedWarrantyMode = WarrantyDisplayMode | "inline-accordion";

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
  selectedOfferId: controlledOfferId,
  onSelectOffer,
  isLoggedIn = false,
  warrantyMode = "inline-accordion",
}: {
  offers: CatalogOffer[];
  locale: Locale;
  slug: string;
  resellerTier?: { id: string; name: string; discountPercent: number } | null;
  wholesalePrices?: Record<string, { price: number; marginCents: number }>;
  selectedOfferId?: string;
  onSelectOffer?: (id: string) => void;
  isLoggedIn?: boolean;
  warrantyMode?: ExtendedWarrantyMode;
}) {
  const t = useTranslations("product");
  const tc = useTranslations("checkout");
  const { addItem } = useCart();

  const [internalSelected, setInternalSelected] = useState(offers[0]?.id ?? "");
  const selected = controlledOfferId !== undefined ? controlledOfferId : internalSelected;
  const setSelected = onSelectOffer ?? setInternalSelected;

  const [customerInput, setCustomerInput] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [differentActivationEmail, setDifferentActivationEmail] = useState(false);
  const [state, action, pending] = useActionState<BuyState, FormData>(buyNow, {});

  const offer = offers.find((o) => o.id === selected) ?? offers[0];
  const selectedOfferId = offer?.id ?? "";
  const errorKey = state.error ? (ERROR_KEY[state.error] ?? "errorGeneric") : null;

  const wp = offer ? wholesalePrices?.[offer.id] : undefined;
  const effectivePrice = wp ? wp.price : (offer?.price ?? 0);
  const effectiveFee = offer ? Math.max(0, effectivePrice - offer.baseCost) : 0;

  const inputType = (offer?.customerInputType || (offer?.requiresCustomerInput ? "TEXT" : "NONE")).toUpperCase();
  const isActivationRequired = Boolean(offer?.requiresCustomerInput && inputType !== "NONE");
  const isEmailActivation = isActivationRequired && inputType === "EMAIL";

  // When guest is using single email for both account & email activation
  const effectiveCustomerInput =
    !isLoggedIn && isEmailActivation && !differentActivationEmail
      ? guestEmail
      : customerInput;

  const isActivationValid = !isActivationRequired || effectiveCustomerInput.trim().length > 0;
  const isGuestEmailValid = isLoggedIn || guestEmail.trim().length > 0;
  const canSubmit = !pending && Boolean(offer) && isActivationValid && isGuestEmailValid;

  const formattedSelected = offer
    ? formatVariantTitle(offer.label[locale] ?? offer.label.en)
    : { title: "", tags: [] };

  const handleStickyClick = (e: React.MouseEvent) => {
    if (!canSubmit) {
      e.preventDefault();
      // Scroll directly to the first unfilled required input on mobile
      const firstInvalid = document.querySelector<HTMLInputElement>(
        "form input[required]:invalid, form input[required]:placeholder-shown"
      );
      if (firstInvalid) {
        firstInvalid.focus();
        firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  return (
    <form action={action} className="pb-24 sm:pb-0">
      <input type="hidden" name="locale" value={locale} />
      {/* Where to come back to after signing in. Validated server-side. */}
      <input type="hidden" name="returnTo" value={`/${locale}/products/${slug}`} />
      <input type="hidden" name="offerId" value={selectedOfferId} />

      {/* Hidden inputs to pass computed values to server action if unified */}
      {!isLoggedIn && isEmailActivation && !differentActivationEmail ? (
        <input type="hidden" name="customerInput" value={guestEmail} />
      ) : null}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--fg)]">{t("chooseOffer")}</h2>
        {resellerTier && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            ⭐ {resellerTier.name} ({resellerTier.discountPercent}% Off)
          </span>
        )}
      </div>

      {/* COMPACT & VISUAL VARIANT CARDS */}
      <div className="mt-3 flex flex-col gap-2">
        {offers.map((o) => {
          const itemWp = wholesalePrices?.[o.id];
          const oInputType = (o.customerInputType || (o.requiresCustomerInput ? "TEXT" : "NONE")).toUpperCase();
          const formatted = formatVariantTitle(o.label[locale] ?? o.label.en);
          const isSelected = selected === o.id;

          return (
            <div
              key={o.id}
              onClick={() => setSelected(o.id)}
              className={`relative flex flex-col cursor-pointer justify-between gap-1 rounded-2xl border px-3.5 py-2.5 transition-all duration-200 ${
                isSelected
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-2 ring-[var(--accent)]/30 shadow-xs"
                  : "border-[var(--border)] bg-[var(--surface-2)]/60 hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3 w-full">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Custom Animated Checkmark Radio Circle */}
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
                      isSelected
                        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)] scale-105"
                        : "border-[var(--border-strong)] bg-[var(--surface)] text-transparent"
                    }`}
                    aria-hidden
                  >
                    <svg
                      className="h-3 w-3 stroke-[2.5]"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        d="M3.5 8.5L6.5 11.5L12.5 4.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <input
                    type="radio"
                    name="offerChoice"
                    value={o.id}
                    checked={isSelected}
                    onChange={() => setSelected(o.id)}
                    className="sr-only"
                  />

                  <div className="flex flex-col min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-[var(--fg)] truncate">
                        {formatted.title}
                      </span>
                      {o.badge && (
                        <span className="rounded-full bg-[var(--discount)] px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                          {o.badge}
                        </span>
                      )}
                    </div>

                    {/* Subtitle Feature Tags */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {oInputType === "NONE" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <span>⚡</span>
                          <span>{tc("deliveryTypeNone")}</span>
                        </span>
                      ) : oInputType === "EMAIL" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                          <span>📧</span>
                          <span>{tc("deliveryTypeEmail")}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                          <span>👤</span>
                          <span>{tc("deliveryTypeUsername")}</span>
                        </span>
                      )}

                      {formatted.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--fg-muted)]"
                        >
                          {tag}
                        </span>
                      ))}

                      {o.stock !== undefined && o.stock <= 5 && (
                        <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
                          {t("stockLimited")}: {o.stock}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Price section */}
                <div className="text-right shrink-0">
                  {itemWp ? (
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[var(--fg-muted)] line-through">
                          <PriceCompact cents={o.price} locale={locale} />
                        </span>
                        <Price cents={itemWp.price} locale={locale} size="sm" />
                      </div>
                      {itemWp.marginCents > 0 && (
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          Wholesale Rate
                        </span>
                      )}
                    </div>
                  ) : (
                    <Price cents={o.price} locale={locale} compareAt={o.compareAt} size="sm" />
                  )}
                </div>
              </div>

              {/* INLINE COLLAPSIBLE ACCORDION ON ACTIVE CARD (Approach A) */}
              {isSelected && warrantyMode === "inline-accordion" && (
                <CardWarrantyAccordion offer={o} locale={locale} />
              )}
            </div>
          );
        })}
      </div>

      {/* STANDALONE WARRANTY BOX (Used when warrantyMode is "card" or "accordion") */}
      {offer && warrantyMode !== "inline-accordion" && (
        <OfferWarranty
          offer={offer}
          locale={locale}
          mode={warrantyMode}
        />
      )}

      {/* DYNAMIC IN-PAGE INPUT SECTION */}
      {/* CASE 1: Offer requires NO input (Instant Delivery) */}
      {!isActivationRequired && !isLoggedIn && (
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-4">
          <label htmlFor="guestAccountEmail" className="block text-xs font-bold text-[var(--fg)]">
            {tc("accountEmailLabel")}
          </label>
          <input
            id="guestAccountEmail"
            name="email"
            type="email"
            required
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            maxLength={254}
            placeholder="you@example.com"
            className="mt-1.5 h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
          />
          <p className="mt-1.5 text-[11px] text-[var(--fg-muted)]">
            {tc("guestEmailNotice")}
          </p>
        </div>
      )}

      {/* CASE 2: Offer requires EMAIL activation (e.g. Gemini Add Slot) */}
      {isActivationRequired && isEmailActivation && (
        <div className="mt-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
          {isLoggedIn ? (
            /* Logged-in user: only ask for activation email */
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="customerActivationEmail" className="block text-xs font-bold text-[var(--fg)]">
                  {offer.customerPrompt || tc("activationEmailLabel")}
                </label>
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                  {tc("deliveryTypeEmail")}
                </span>
              </div>
              <input
                id="customerActivationEmail"
                name="customerInput"
                type="email"
                required
                value={customerInput}
                onChange={(e) => setCustomerInput(e.target.value)}
                maxLength={254}
                placeholder="you@gmail.com"
                className="mt-1.5 h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
              />
              <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                {locale === "ar"
                  ? "البريد الإلكتروني الذي ترغب بتفعيل الاشتراك عليه لدى المزود."
                  : locale === "fr"
                    ? "L'adresse e-mail sur laquelle vous souhaitez activer cet abonnement."
                    : "The email address where the provider will invite or activate this subscription."}
              </p>
            </div>
          ) : !differentActivationEmail ? (
            /* Guest buyer: single email used for both */
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="unifiedGuestEmail" className="block text-xs font-bold text-[var(--fg)]">
                  {tc("singleEmailLabel")}
                </label>
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                  1-Email
                </span>
              </div>
              <input
                id="unifiedGuestEmail"
                name="email"
                type="email"
                required
                value={guestEmail}
                onChange={(e) => {
                  setGuestEmail(e.target.value);
                  setCustomerInput(e.target.value);
                }}
                maxLength={254}
                placeholder="you@example.com"
                className="mt-1.5 h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
              />
              <p className="mt-1.5 text-[11px] text-[var(--fg-muted)]">
                {tc("singleEmailNotice")}
              </p>
              <button
                type="button"
                onClick={() => setDifferentActivationEmail(true)}
                className="mt-2 text-[11px] font-medium text-[var(--accent)] hover:underline"
              >
                + {tc("activateDifferentEmail")}
              </button>
            </div>
          ) : (
            /* Guest buyer who opted to specify a different activation email */
            <div className="space-y-3">
              <div>
                <label htmlFor="splitActivationEmail" className="block text-xs font-bold text-[var(--fg)]">
                  {tc("activationEmailLabel")}
                </label>
                <input
                  id="splitActivationEmail"
                  name="customerInput"
                  type="email"
                  required
                  value={customerInput}
                  onChange={(e) => setCustomerInput(e.target.value)}
                  maxLength={254}
                  placeholder="friend@gmail.com"
                  className="mt-1.5 h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>
              <div>
                <label htmlFor="splitGuestAccountEmail" className="block text-xs font-bold text-[var(--fg)]">
                  {tc("accountEmailLabel")}
                </label>
                <input
                  id="splitGuestAccountEmail"
                  name="email"
                  type="email"
                  required
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  maxLength={254}
                  placeholder="your-personal@example.com"
                  className="mt-1.5 h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setDifferentActivationEmail(false);
                  setCustomerInput(guestEmail);
                }}
                className="text-[11px] text-[var(--fg-muted)] hover:underline"
              >
                ← {locale === "ar" ? "استخدام نفس البريد الإلكتروني" : "Use same email for both"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* CASE 3: Offer requires NON-EMAIL input (e.g. Telegram username or Player ID) */}
      {isActivationRequired && !isEmailActivation && (
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-4 space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="customerNonEmailInput" className="block text-xs font-bold text-[var(--fg)]">
                {offer.customerPrompt || tc("customerInput")}
              </label>
              <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
                {tc("deliveryTypeUsername")}
              </span>
            </div>
            <input
              id="customerNonEmailInput"
              name="customerInput"
              type="text"
              required
              value={customerInput}
              onChange={(e) => setCustomerInput(e.target.value)}
              maxLength={500}
              placeholder={offer.customerPrompt ?? "@username"}
              className="mt-1.5 h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          {!isLoggedIn && (
            <div>
              <label htmlFor="guestAccountEmailNonEmail" className="block text-xs font-bold text-[var(--fg)]">
                {tc("accountEmailLabel")}
              </label>
              <input
                id="guestAccountEmailNonEmail"
                name="email"
                type="email"
                required
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                maxLength={254}
                placeholder="you@example.com"
                className="mt-1.5 h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
              />
              <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                {tc("guestEmailNotice")}
              </p>
            </div>
          )}
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
              ? "رصيد محفظتك غير كافٍ لإتمام هذا الطلب. اشحن محفظتك بالدينار الجزائري عبر بريديموب للمتابعة فوراً."
              : locale === "fr"
                ? "Solde insuffisant dans votre portefeuille. Rechargez via BaridiMob pour finaliser votre commande immédiatement."
                : "Your wallet balance is insufficient to place this order. Top up via Baridimob or Crypto to complete it immediately."}
          </p>
          <a
            href={`/${locale}/account/wallet?amount=${((offer?.price ?? 0) / 100).toFixed(2)}&method=MANUAL_BANK`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 w-full shadow-sm transition-all"
          >
            <span>⚡</span>
            <span>
              {locale === "ar"
                ? `شحن المحفظة (${((offer?.price ?? 0) / 100).toFixed(2)}$) عبر بريديموب ➔`
                : locale === "fr"
                  ? `Recharger (${((offer?.price ?? 0) / 100).toFixed(2)}$) via BaridiMob ➔`
                  : `Top up Wallet ($${((offer?.price ?? 0) / 100).toFixed(2)}) via Baridimob ➔`}
            </span>
          </a>
        </div>
      ) : (
        errorKey && (
          <p
            role="alert"
            className="mt-4 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {tc(errorKey)}
          </p>
        )
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
            customerInput: effectiveCustomerInput.trim() || undefined,
          });
        }}
        className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] text-sm font-bold text-[var(--fg)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
      >
        {t("addToCart")}
      </button>

      {offer && (
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3.5 text-xs space-y-2">
          <div className="flex items-center justify-between text-[var(--fg-muted)]">
            <span>{tc("baseCost")}</span>
            <span className="font-medium text-[var(--fg)]">
              <Price cents={offer.baseCost} locale={locale} size="sm" />
            </span>
          </div>
          <div className="flex items-center justify-between text-[var(--fg-muted)]">
            <span className="flex items-center gap-1">
              <span>{tc("agencyFee")}</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                {locale === "ar" ? "أجرة الوكالة" : "Brokerage"}
              </span>
            </span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              <Price cents={effectiveFee} locale={locale} size="sm" />
            </span>
          </div>
          <div className="border-t border-[var(--border)] pt-2 flex items-center justify-between font-bold text-[var(--fg)]">
            <span>{tc("totalAuthorized")}</span>
            <span>
              <Price cents={effectivePrice} locale={locale} size="sm" />
            </span>
          </div>
        </div>
      )}

      {/* Delivery Requirements Preview Box */}
      {offer && (
        <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-3 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-[var(--fg)]">
            <span aria-hidden>📋</span>
            <span>{tc("deliveryRequirementsTitle")}:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {!isActivationRequired
                ? tc("deliveryTypeNone")
                : isEmailActivation
                  ? tc("deliveryTypeEmail")
                  : tc("deliveryTypeUsername")}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--fg-muted)]">
            {!isActivationRequired
              ? locale === "ar"
                ? "تسليم فوري وتلقائي بعد الدفع. يتم تسليم بيانات الحساب أو المفتاح الرقمي مباشرة دون الحاجة لأي مدخلات."
                : locale === "fr"
                  ? "Livraison instantanée après paiement. Les identifiants ou la clé sont générés automatiquement sans saisie requise."
                  : "Instant delivery after payment. Credentials or license keys are generated automatically with no input required."
              : isEmailActivation
                ? locale === "ar"
                  ? "يتم تفعيل هذا الاشتراك رسمياً على بريدك الإلكتروني عبر دعوة تفعيل أو إضافة إلى المجموعة."
                  : locale === "fr"
                    ? "Cet abonnement sera activé officiellement sur votre adresse e-mail via invitation ou ajout de slot."
                    : "This subscription will be officially activated on your email address via invite link or slot addition."
                : locale === "ar"
                  ? "يتطلب هذا المنتج تزويدنا باسم المستخدم أو المعرف الخاص بك لربط الاشتراك وتفعيله فورياً."
                  : locale === "fr"
                    ? "Ce produit nécessite votre nom d'utilisateur ou identifiant pour lier et activer le service."
                    : "This product requires your username or account identifier to bind and activate the service."}
          </p>
        </div>
      )}

      <div className="mt-3 rounded-xl bg-[var(--surface-2)]/40 border border-[var(--border)]/60 p-2.5 text-[11px] leading-relaxed text-[var(--fg-muted)]">
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
        disabled={!canSubmit}
        className="btn-shine group mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] text-sm font-bold tracking-tight text-[var(--accent-fg)] shadow-sm transition-all duration-300 ease-[var(--ease-premium)] hover:bg-[var(--accent-hover)] hover:shadow-md active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? tc("placing") : tc("agencyProcure")}
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-xs transition-transform duration-300 ease-[var(--ease-premium)] group-hover:translate-x-0.5"
        >
          →
        </span>
      </button>

      {/* MOBILE STICKY BOTTOM CHECKOUT BAR */}
      {offer && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md px-4 py-3 shadow-[var(--elev-3)] sm:hidden flex items-center justify-between gap-3 safe-area-pb">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-[var(--fg)]">
              {formattedSelected.title}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Price cents={effectivePrice} locale={locale} size="sm" />
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                {locale === "ar" ? "شامل الأتعاب" : "Inc. fee"}
              </span>
            </div>
          </div>
          <button
            type="submit"
            onClick={handleStickyClick}
            disabled={pending}
            className="btn-shine inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-5 text-xs font-bold text-[var(--accent-fg)] shadow-sm shrink-0 active:scale-95 disabled:opacity-60"
          >
            {pending ? tc("placing") : tc("agencyProcure")} ➔
          </button>
        </div>
      )}
    </form>
  );
}
