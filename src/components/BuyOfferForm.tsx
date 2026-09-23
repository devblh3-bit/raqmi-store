"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { useTranslations } from "next-intl";
import { buyNow, type BuyState } from "@/app/actions/buy";
import type { CatalogOffer } from "@/lib/catalog";
import type { Locale } from "@/i18n";
import { Price, PriceCompact } from "./Price";
import { ProcureModal } from "./ProcureModal";

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
}: {
  offers: CatalogOffer[];
  locale: Locale;
  slug: string;
  resellerTier?: { id: string; name: string; discountPercent: number } | null;
  wholesalePrices?: Record<string, { price: number; marginCents: number }>;
  selectedOfferId?: string;
  onSelectOffer?: (id: string) => void;
  isLoggedIn?: boolean;
}) {
  const t = useTranslations("product");
  const tc = useTranslations("checkout");
  const { addItem } = useCart();
  const formRef = useRef<HTMLFormElement>(null);

  const [internalSelected, setInternalSelected] = useState(offers[0]?.id ?? "");
  const selected = controlledOfferId !== undefined ? controlledOfferId : internalSelected;
  const setSelected = onSelectOffer ?? setInternalSelected;
  const [customerInput, setCustomerInput] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [state, action, pending] = useActionState<BuyState, FormData>(buyNow, {});

  const offer = offers.find((o) => o.id === selected) ?? offers[0];
  const selectedOfferId = offer?.id ?? "";
  const errorKey = state.error ? (ERROR_KEY[state.error] ?? "errorGeneric") : null;

  const wp = offer ? wholesalePrices?.[offer.id] : undefined;
  const effectivePrice = wp ? wp.price : (offer?.price ?? 0);
  const effectiveFee = offer ? Math.max(0, effectivePrice - offer.baseCost) : 0;

  const inputType = (offer?.customerInputType || (offer?.requiresCustomerInput ? "TEXT" : "NONE")).toUpperCase();

  const handleActionClick = () => {
    if (!offer) return;
    // If the user is logged in AND the offer has no requirements, submit directly
    if (isLoggedIn && !offer.requiresCustomerInput) {
      formRef.current?.requestSubmit();
    } else {
      // Need customer activation input and/or guest account email
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <form ref={formRef} action={action}>
        <input type="hidden" name="locale" value={locale} />
        {/* Where to come back to after signing in. Validated server-side. */}
        <input type="hidden" name="returnTo" value={`/${locale}/products/${slug}`} />
        <input type="hidden" name="offerId" value={selectedOfferId} />
        <input type="hidden" name="customerInput" value={customerInput} />
        <input type="hidden" name="email" value={guestEmail} />

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
            const itemWp = wholesalePrices?.[o.id];
            const oInputType = (o.customerInputType || (o.requiresCustomerInput ? "TEXT" : "NONE")).toUpperCase();

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
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{o.label[locale] ?? o.label.en}</span>
                      {o.badge && (
                        <span className="rounded-full bg-[var(--discount)] px-2 py-0.5 text-[11px] font-bold text-white">
                          {o.badge}
                        </span>
                      )}
                    </div>
                    {/* Visual delivery requirement indicator */}
                    <div className="flex items-center gap-2">
                      {oInputType === "NONE" ? (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {tc("deliveryTypeNone")}
                        </span>
                      ) : oInputType === "EMAIL" ? (
                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                          {tc("deliveryTypeEmail")}
                        </span>
                      ) : (
                        <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                          {tc("deliveryTypeUsername")}
                        </span>
                      )}
                      {o.stock !== undefined && o.stock <= 5 && (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
                          {t("stockLimited")}: {o.stock}
                        </span>
                      )}
                    </div>
                  </div>
                </span>

                <span className="text-sm font-bold">
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
                </span>
              </label>
            );
          })}
        </div>

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
            if (offer.requiresCustomerInput && !customerInput.trim()) {
              setIsModalOpen(true);
              return;
            }
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
                {inputType === "NONE"
                  ? tc("deliveryTypeNone")
                  : inputType === "EMAIL"
                    ? tc("deliveryTypeEmail")
                    : tc("deliveryTypeUsername")}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--fg-muted)]">
              {inputType === "NONE"
                ? locale === "ar"
                  ? "تسليم فوري وتلقائي بعد الدفع. يتم تسليم بيانات الحساب أو المفتاح الرقمي مباشرة دون الحاجة لأي مدخلات."
                  : locale === "fr"
                    ? "Livraison instantanée après paiement. Les identifiants ou la clé sont générés automatiquement sans saisie requise."
                    : "Instant delivery after payment. Credentials or license keys are generated automatically with no input required."
                : inputType === "EMAIL"
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
          type="button"
          disabled={pending || !offers.length}
          onClick={handleActionClick}
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
      </form>

      {/* Procurement Modal */}
      {offer && (
        <ProcureModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          offer={offer}
          locale={locale}
          isLoggedIn={isLoggedIn}
          customerInput={customerInput}
          setCustomerInput={setCustomerInput}
          guestEmail={guestEmail}
          setGuestEmail={setGuestEmail}
          pending={pending}
          effectivePrice={effectivePrice}
          effectiveFee={effectiveFee}
          onConfirm={() => {
            setIsModalOpen(false);
            setTimeout(() => {
              formRef.current?.requestSubmit();
            }, 50);
          }}
        />
      )}
    </>
  );
}
