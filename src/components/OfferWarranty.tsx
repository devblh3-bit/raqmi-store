import React from "react";
import type { CatalogOffer } from "@/lib/catalog";
import type { Locale } from "@/i18n";
import { formatVariantTitle } from "@/lib/variant-formatter";

export type WarrantyDisplayMode = "card" | "accordion";

export interface OfferWarrantyProps {
  offer: CatalogOffer;
  locale: Locale;
  mode?: WarrantyDisplayMode;
  className?: string;
}

export function cleanRulesText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/blockquote>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function OfferWarranty({
  offer,
  locale,
  mode = "card",
  className = "",
}: OfferWarrantyProps) {
  const rawRules = offer.rules?.[locale] || offer.rules?.en || "";
  const cleanedRules = cleanRulesText(rawRules);

  const defaultWarranty =
    locale === "ar"
      ? "ضمان استبدال فوري طوال فترة الاشتراك المحددة. في حال حدوث أي انقطاع، يمكنك طلب الاستبدال فوراً عبر صفحة تتبع الطلب."
      : locale === "fr"
        ? "Garantie de remplacement immédiat pendant toute la durée spécifiée. En cas d'interruption, contactez le support via le suivi de commande."
        : "Immediate replacement warranty throughout the specified period. In case of any disruption, contact support via Track Order for a swift replacement.";

  const textToDisplay = cleanedRules || defaultWarranty;
  const formatted = formatVariantTitle(offer.label[locale] ?? offer.label.en);

  const title =
    locale === "ar"
      ? "الضمان وتعليمات الاستخدام"
      : locale === "fr"
        ? "Garantie & Instructions"
        : "Warranty & Instructions";

  const instantGuaranteeLabel =
    locale === "ar"
      ? "ضمان الاستبدال الفوري"
      : locale === "fr"
        ? "Garantie de remplacement"
        : "Replacement Guarantee";

  const genuineLabel =
    locale === "ar"
      ? "ترخيص أصلي 100%"
      : locale === "fr"
        ? "Licence 100% Officielle"
        : "100% Genuine License";

  if (mode === "accordion") {
    return (
      <details
        open
        className={`group mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 transition-colors ${className}`}
      >
        <summary className="flex cursor-pointer items-center justify-between p-3.5 select-none text-xs font-bold text-[var(--fg)] outline-none hover:text-[var(--accent)]">
          <div className="flex items-center gap-2">
            <span className="text-base" aria-hidden>🛡️</span>
            <span>{title}</span>
            {formatted.title && (
              <span className="hidden sm:inline-block rounded-md bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--fg-muted)] border border-[var(--border)]">
                {formatted.title}
              </span>
            )}
          </div>
          <span className="text-xs text-[var(--fg-muted)] transition-transform duration-200 group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="border-t border-[var(--border)]/60 px-4 pb-4 pt-2.5">
          <p className="text-xs sm:text-sm leading-relaxed text-[var(--fg-muted)] whitespace-pre-line">
            {textToDisplay}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)]/40 text-[11px] font-medium text-[var(--fg-muted)]">
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span>✓</span> {instantGuaranteeLabel}
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <span>🔒</span> {genuineLabel}
            </span>
          </div>
        </div>
      </details>
    );
  }

  // Option 1: Contextual Card directly visible under the variant selector
  return (
    <div
      className={`mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 transition-all duration-200 dark:border-emerald-400/20 dark:bg-emerald-950/20 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-bold text-emerald-600 dark:text-emerald-400" aria-hidden>
            🛡️
          </span>
          <span className="text-xs font-bold text-[var(--fg)]">
            {title}
          </span>
        </div>
        {formatted.title && (
          <span className="truncate max-w-[160px] rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--fg-muted)]">
            {formatted.title}
          </span>
        )}
      </div>

      <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-[var(--fg-muted)] whitespace-pre-line">
        {textToDisplay}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 pt-2.5 border-t border-emerald-500/15 text-[11px] font-medium text-[var(--fg-muted)]">
        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
          <span>✓</span> {instantGuaranteeLabel}
        </span>
        <span className="inline-flex items-center gap-1 text-[var(--fg-muted)]">
          <span>🔒</span> {genuineLabel}
        </span>
      </div>
    </div>
  );
}
