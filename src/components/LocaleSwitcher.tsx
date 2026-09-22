"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import type { Locale } from "@/i18n";
import { useCurrency, type Currency } from "@/components/CurrencyProvider";

function GlobeIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx={12} cy={12} r={10} />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function ChevronDownIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const LANGUAGES: Array<{ code: Locale; label: string; flag: string; short: string }> = [
  { code: "en", label: "English", flag: "🇬🇧", short: "EN" },
  { code: "ar", label: "العربية", flag: "🇸🇦", short: "AR" },
  { code: "fr", label: "Français", flag: "🇫🇷", short: "FR" },
];

const CURRENCIES: Array<{ code: Currency; labelEn: string; labelAr: string; symbol: string; flag: string }> = [
  { code: "DZD", labelEn: "Algerian Dinar", labelAr: "دينار جزائري", symbol: "DA / د.ج", flag: "🇩🇿" },
  { code: "USD", labelEn: "US Dollar", labelAr: "دولار أمريكي", symbol: "$", flag: "🇺🇸" },
];

export default function LocaleSwitcher({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { currency, setCurrency, dzdRate } = useCurrency();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const currentLang = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];
  const currencyLabel = currency === "DZD" ? (locale === "ar" ? "د.ج" : "DZD") : "$";

  // Build target link preserving current route
  const getLanguageHref = (targetLocale: Locale) => {
    if (!pathname) return `/${targetLocale}`;
    const regex = new RegExp(`^/${locale}(/|$)`);
    return pathname.replace(regex, `/${targetLocale}$1`);
  };

  return (
    <div ref={ref} className="relative">
      {/* Option A: Combined Pill [ 🌐 EN · DZD ▾ ] */}
      <button
        aria-label="Select language and currency"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-1.5 rounded-full bg-[var(--surface)]/70 px-2.5 sm:px-3 text-xs font-semibold text-[var(--fg)] shadow-[inset_0_0_0_1px_var(--border)] backdrop-blur-md transition-all duration-200 hover:bg-[var(--surface)] hover:shadow-[var(--elev-1)] active:scale-95 sm:h-9"
      >
        <GlobeIcon className="h-3.5 w-3.5 text-[var(--fg-muted)] shrink-0" />
        <span className="tracking-tight">
          {currentLang.short} · {currencyLabel}
        </span>
        <ChevronDownIcon className={`h-3 w-3 text-[var(--fg-faint)] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--elev-3)] animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl"
        >
          {/* Section 1: Language */}
          <div className="px-2 pt-1 pb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-faint)]">
              {locale === "ar" ? "اللغة (Language)" : "Language"}
            </span>
          </div>
          <div className="space-y-0.5">
            {LANGUAGES.map((l) => {
              const isSelected = l.code === locale;
              return (
                <Link
                  key={l.code}
                  href={getLanguageHref(l.code)}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium tracking-tight transition-colors ${
                    isSelected
                      ? "bg-[var(--accent)] text-white font-bold"
                      : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{l.flag}</span>
                    <span>{l.label}</span>
                  </span>
                  {isSelected && <CheckIcon className="h-3.5 w-3.5 text-white" />}
                </Link>
              );
            })}
          </div>

          <div className="my-2 border-t border-[var(--border)]" />

          {/* Section 2: Currency */}
          <div className="px-2 pt-0.5 pb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-faint)]">
              {locale === "ar" ? "العملة (Currency)" : "Display Currency"}
            </span>
            <span className="text-[9px] font-semibold text-[var(--fg-faint)]">
              1 USD ≈ {dzdRate} DA
            </span>
          </div>
          <div className="space-y-0.5">
            {CURRENCIES.map((c) => {
              const isSelected = c.code === currency;
              return (
                <button
                  key={c.code}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setCurrency(c.code);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium tracking-tight text-start transition-colors ${
                    isSelected
                      ? "bg-[var(--accent)] text-white font-bold"
                      : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{c.flag}</span>
                    <span>{c.code}</span>
                    <span className={`text-[11px] ${isSelected ? "text-white/80" : "text-[var(--fg-faint)]"}`}>
                      ({locale === "ar" ? c.labelAr : c.symbol})
                    </span>
                  </span>
                  {isSelected && <CheckIcon className="h-3.5 w-3.5 text-white" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
