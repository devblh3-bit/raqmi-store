"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { CatalogOffer } from "@/lib/catalog";
import type { Locale } from "@/i18n";
import { Price } from "@/components/Price";

export interface ProcureModalProps {
  isOpen: boolean;
  onClose: () => void;
  offer: CatalogOffer;
  locale: Locale;
  isLoggedIn: boolean;
  customerInput: string;
  setCustomerInput: (val: string) => void;
  guestEmail: string;
  setGuestEmail: (val: string) => void;
  onConfirm: () => void;
  pending: boolean;
  effectivePrice: number;
  effectiveFee: number;
}

export function ProcureModal({
  isOpen,
  onClose,
  offer,
  locale,
  isLoggedIn,
  customerInput,
  setCustomerInput,
  guestEmail,
  setGuestEmail,
  onConfirm,
  pending,
  effectivePrice,
  effectiveFee,
}: ProcureModalProps) {
  const tc = useTranslations("checkout");
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const inputType = (offer.customerInputType || "NONE").toUpperCase();
  const isEmailActivation = inputType === "EMAIL";
  const [useSameEmail, setUseSameEmail] = useState(true);

  // Focus trap / auto-focus first input
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const effectiveCustomerInput =
    !isLoggedIn && isEmailActivation && useSameEmail ? guestEmail : customerInput;

  const isActivationValid = !offer.requiresCustomerInput || effectiveCustomerInput.trim().length > 0;
  const isGuestEmailValid = isLoggedIn || guestEmail.trim().length > 0;
  const canProceed = !pending && isActivationValid && isGuestEmailValid;

  const handleGuestEmailChange = (val: string) => {
    setGuestEmail(val);
    if (isEmailActivation && useSameEmail) {
      setCustomerInput(val);
    }
  };

  const handleUseSameEmailToggle = (checked: boolean) => {
    setUseSameEmail(checked);
    if (checked) {
      setCustomerInput(guestEmail);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="procure-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      {/* Modal Dialog Card */}
      <div
        ref={modalRef}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-3)] transition-all animate-in fade-in zoom-in-95 duration-200 my-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl" aria-hidden>
                📜
              </span>
              <h2 id="procure-modal-title" className="text-base font-bold text-[var(--fg)]">
                {tc("modalTitle")}
              </h2>
            </div>
            <p className="mt-1 text-xs text-[var(--fg-muted)] leading-relaxed">
              {tc("modalSubtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tc("modalCancel")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Selected Offer & Agency Breakdown Summary */}
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3.5 text-xs space-y-2">
          <div className="flex items-center justify-between font-semibold text-[var(--fg)]">
            <span>{offer.label[locale] ?? offer.label.en}</span>
            <Price cents={effectivePrice} locale={locale} size="sm" />
          </div>
          <div className="flex items-center justify-between text-[var(--fg-muted)] text-[11px] border-t border-[var(--border)]/40 pt-1.5">
            <span>
              {tc("baseCost")}: <Price cents={offer.baseCost} locale={locale} size="sm" />
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {tc("agencyFee")}: <Price cents={effectiveFee} locale={locale} size="sm" />
            </span>
          </div>
        </div>

        {/* Form Inputs Container */}
        <div className="mt-5 space-y-4">
          {/* Guest Account Email (if not logged in) */}
          {!isLoggedIn && (
            <div>
              <label htmlFor="modalGuestEmail" className="block text-xs font-bold text-[var(--fg)]">
                {locale === "ar"
                  ? "البريد الإلكتروني لحسابك وإيصال الطلب"
                  : locale === "fr"
                    ? "Votre adresse e-mail (accès compte & reçu)"
                    : "Your Email Address (account access & receipt)"}
              </label>
              <input
                ref={inputRef}
                id="modalGuestEmail"
                type="email"
                required
                value={guestEmail}
                onChange={(e) => handleGuestEmailChange(e.target.value)}
                maxLength={254}
                placeholder="you@example.com"
                className="mt-1.5 h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm outline-none focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--ring)]"
              />
              <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                {tc("guestEmailNotice")}
              </p>

              {/* If activation is also an email, provide the auto-sync toggle */}
              {isEmailActivation && (
                <label className="mt-2.5 flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-[var(--fg)]">
                  <input
                    type="checkbox"
                    checked={useSameEmail}
                    onChange={(e) => handleUseSameEmailToggle(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                  />
                  <span>{tc("useSameEmail")}</span>
                </label>
              )}
            </div>
          )}

          {/* Product Activation Input (if required AND (logged in OR not auto-synced)) */}
          {offer.requiresCustomerInput && (isLoggedIn || !isEmailActivation || !useSameEmail) && (
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="modalCustomerInput" className="block text-xs font-bold text-[var(--fg)]">
                  {offer.customerPrompt || tc("customerInput")}
                </label>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  {isEmailActivation
                    ? locale === "ar"
                      ? "بريد التفعيل"
                      : "Activation Email"
                    : locale === "ar"
                      ? "معرف التفعيل"
                      : "Activation Identifier"}
                </span>
              </div>
              <input
                ref={isLoggedIn ? inputRef : undefined}
                id="modalCustomerInput"
                type={isEmailActivation ? "email" : "text"}
                required
                value={customerInput}
                onChange={(e) => setCustomerInput(e.target.value)}
                maxLength={500}
                placeholder={offer.customerPrompt || (isEmailActivation ? "account@gmail.com" : "@username")}
                className="mt-1.5 h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm outline-none focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--ring)]"
              />
              <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                {isEmailActivation
                  ? locale === "ar"
                    ? "البريد الإلكتروني الذي ترغب بتفعيل الاشتراك عليه لدى المزود."
                    : "The email address where the provider will invite or activate this subscription."
                  : locale === "ar"
                    ? "بيانات الحساب المطلوبة من قبل المزود للتفعيل الفوري."
                    : "Required account identifier for instant automated activation."}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="h-10 rounded-full border border-[var(--border)] px-4 text-xs font-semibold text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] transition-colors"
          >
            {tc("modalCancel")}
          </button>
          <button
            type="button"
            disabled={!canProceed}
            onClick={() => {
              if (isEmailActivation && !isLoggedIn && useSameEmail) {
                setCustomerInput(guestEmail);
              }
              onConfirm();
            }}
            className="btn-shine inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 text-xs font-bold text-[var(--accent-fg)] shadow-sm hover:bg-[var(--accent-hover)] transition-all disabled:opacity-50"
          >
            {pending ? tc("placing") : tc("modalConfirm")} ➔
          </button>
        </div>
      </div>
    </div>
  );
}
