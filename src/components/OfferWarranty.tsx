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

function formatUrlLabel(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("docs.google.com")) {
      return "Google Docs Guide ↗";
    }
    const cleanHost = parsed.hostname.replace(/^www\./, "");
    const pathname = parsed.pathname.length > 20 ? parsed.pathname.slice(0, 18) + "…" : parsed.pathname;
    const hash = parsed.hash ? ` (${parsed.hash.replace(/^#/, "")})` : "";
    return `${cleanHost}${pathname}${hash} ↗`;
  } catch {
    return url.length > 35 ? url.slice(0, 32) + "… ↗" : `${url} ↗`;
  }
}

function renderTextWithLinks(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s<>"'()]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, i) => {
    if (part.match(/^https?:\/\//i)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-0.5 font-semibold text-[var(--accent)] underline underline-offset-2 decoration-[var(--accent)]/50 hover:text-[var(--accent-hover)] hover:decoration-[var(--accent)] break-all"
        >
          <span>{formatUrlLabel(part)}</span>
        </a>
      );
    }
    return part;
  });
}

export function FormattedRulesView({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-[var(--fg)]">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Callout notices (Important, warnings, note)
        if (
          trimmed.startsWith("⚠️") ||
          trimmed.toLowerCase().startsWith("important:") ||
          trimmed.toLowerCase().startsWith("important notice:") ||
          trimmed.startsWith("ملاحظة:") ||
          trimmed.startsWith("تنبيه:")
        ) {
          return (
            <div
              key={idx}
              className="my-2 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200"
            >
              <span className="shrink-0 text-sm">⚠️</span>
              <div className="flex-1 font-medium leading-normal">
                {renderTextWithLinks(trimmed.replace(/^⚠️\s*/u, ""))}
              </div>
            </div>
          );
        }

        // Step instruction items (Step 1, Step 2, etc.)
        if (
          trimmed.startsWith("🔹 Step") ||
          trimmed.startsWith("Step ") ||
          trimmed.startsWith("الخطوة ") ||
          trimmed.startsWith("Étape ")
        ) {
          return (
            <div
              key={idx}
              className="my-1 flex items-start gap-2 rounded-lg border border-[var(--border)]/70 bg-[var(--surface-2)]/60 px-2.5 py-1.5"
            >
              <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[10px] font-bold text-[var(--accent)]">
                ✓
              </span>
              <div className="flex-1 leading-normal text-[var(--fg)]">
                {renderTextWithLinks(trimmed.replace(/^🔹\s*/u, "").replace(/^[•\-]\s*/, ""))}
              </div>
            </div>
          );
        }

        // Section headings (e.g. Quick Setup Instructions, Available Models)
        if (
          trimmed.startsWith("📋") ||
          trimmed.startsWith("🤖") ||
          trimmed.startsWith("📖") ||
          trimmed.startsWith("📊")
        ) {
          return (
            <div key={idx} className="pt-2 font-bold text-[var(--fg)] flex items-center gap-1.5">
              <span>{renderTextWithLinks(trimmed)}</span>
            </div>
          );
        }

        // Technical key/value or endpoints
        if (trimmed.startsWith("🌐 Base URL:") || trimmed.startsWith("🔑 API Key:")) {
          const colonIdx = trimmed.indexOf(":");
          const label = trimmed.slice(0, colonIdx);
          const val = trimmed.slice(colonIdx + 1).trim();
          return (
            <div key={idx} className="flex flex-wrap items-center gap-1.5 py-0.5">
              <span className="font-semibold text-[var(--fg-muted)]">{label}:</span>
              <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--accent)] border border-[var(--border)] select-all">
                {val}
              </code>
            </div>
          );
        }

        // Normal text line
        return (
          <div key={idx} className="text-[var(--fg-muted)] leading-relaxed">
            {renderTextWithLinks(trimmed)}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Inline Accordion directly embedded inside an active variant card (Approach A).
 */
export function CardWarrantyAccordion({
  offer,
  locale,
  className = "",
}: {
  offer: CatalogOffer;
  locale: Locale;
  className?: string;
}) {
  const rawRules = offer.rules?.[locale] || offer.rules?.en || "";
  const cleanedRules = cleanRulesText(rawRules);

  const defaultWarranty =
    locale === "ar"
      ? "توصيل رقمي وتعليمات الاستخدام وفق مواصفات المزود الرسمية."
      : locale === "fr"
        ? "Livraison numérique et instructions selon les spécifications officielles du fournisseur."
        : "Digital delivery and usage instructions as specified by the official provider.";

  const textToDisplay = cleanedRules || defaultWarranty;

  const title =
    locale === "ar"
      ? "الضمان وتعليمات الاستخدام"
      : locale === "fr"
        ? "Garantie & Instructions"
        : "Warranty & Instructions";

  const viewRulesHint =
    locale === "ar" ? "عرض التفاصيل" : locale === "fr" ? "Afficher" : "View rules";

  return (
    <div
      className={`mt-2.5 pt-2 border-t border-[var(--border)]/70 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <details className="group">
        <summary className="flex cursor-pointer items-center justify-between select-none py-0.5 text-xs font-semibold text-[var(--fg)] outline-none hover:text-[var(--accent)]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm shrink-0" aria-hidden>🛡️</span>
            <span className="truncate">{title}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-[var(--fg-muted)] shrink-0">
            <span className="group-open:hidden">{viewRulesHint}</span>
            <span className="transition-transform duration-200 group-open:rotate-180 text-xs">
              ▾
            </span>
          </div>
        </summary>
        <div className="mt-2 max-h-60 sm:max-h-72 overflow-y-auto overscroll-contain rounded-xl bg-[var(--surface)] p-3 text-xs border border-[var(--border)]/70 shadow-xs pr-2 scrollbar-thin">
          <FormattedRulesView text={textToDisplay} />
        </div>
      </details>
    </div>
  );
}

/**
 * Standalone Warranty component (used when displaying warranty as a separate block).
 */
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
      ? "توصيل رقمي وتعليمات الاستخدام وفق مواصفات المزود الرسمية."
      : locale === "fr"
        ? "Livraison numérique et instructions selon les spécifications officielles du fournisseur."
        : "Digital delivery and usage instructions as specified by the official provider.";

  const textToDisplay = cleanedRules || defaultWarranty;
  const formatted = formatVariantTitle(offer.label[locale] ?? offer.label.en);

  const title =
    locale === "ar"
      ? "الضمان وتعليمات الاستخدام"
      : locale === "fr"
        ? "Garantie & Instructions"
        : "Warranty & Instructions";

  if (mode === "accordion") {
    const viewRulesHint =
      locale === "ar" ? "عرض التفاصيل" : locale === "fr" ? "Afficher" : "View rules";

    return (
      <details
        className={`group mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 transition-colors ${className}`}
      >
        <summary className="flex cursor-pointer items-center justify-between p-3.5 select-none text-xs font-bold text-[var(--fg)] outline-none hover:text-[var(--accent)]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0" aria-hidden>🛡️</span>
            <span className="truncate">{title}</span>
            {formatted.title && (
              <span className="truncate max-w-[140px] rounded-md bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--fg-muted)] border border-[var(--border)]">
                {formatted.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)] shrink-0">
            <span className="text-[11px] font-normal group-open:hidden">
              {viewRulesHint}
            </span>
            <span className="transition-transform duration-200 group-open:rotate-180">
              ▾
            </span>
          </div>
        </summary>
        <div className="border-t border-[var(--border)]/60 px-4 pb-4 pt-2.5 max-h-72 overflow-y-auto overscroll-contain pr-3 scrollbar-thin">
          <FormattedRulesView text={textToDisplay} />
        </div>
      </details>
    );
  }

  // Option 1: Contextual Card directly visible under the variant selector
  return (
    <div
      className={`mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-4 transition-all duration-200 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface)] text-sm font-bold border border-[var(--border)]" aria-hidden>
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

      <div className="mt-2.5 max-h-72 overflow-y-auto overscroll-contain pr-2 scrollbar-thin">
        <FormattedRulesView text={textToDisplay} />
      </div>
    </div>
  );
}
