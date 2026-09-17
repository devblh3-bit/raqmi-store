"use client";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import type { Locale } from "@/i18n";

function GlobeIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx={12} cy={12} r={10} />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

export default function LocaleSwitcher({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="Select language"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-1 rounded-full bg-[var(--surface)]/60 px-2.5 text-xs font-semibold text-[var(--fg)] shadow-[inset_0_0_0_1px_var(--border)] backdrop-blur-md transition-all duration-200 hover:bg-[var(--surface)] hover:shadow-[var(--elev-1)] active:scale-95 sm:h-9"
      >
        <GlobeIcon className="h-[13px] w-[13px]" />
        <span className="hidden sm:inline">{locale === "ar" ? "🇸🇦 AR" : locale === "fr" ? "🇫🇷 FR" : "🇬🇧 EN"}</span>
        <span className="sm:hidden">{locale.toUpperCase()}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 top-[calc(100%+8px)] z-50 min-w-[160px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--elev-3)]"
        >
          {(["en", "fr", "ar"] as Locale[]).map((l) => (
            <Link
              key={l}
              href={`/${l}`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium tracking-tight transition-colors ${l === locale ? "bg-[var(--fg)] text-white dark:bg-white dark:text-black" : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"}`}
            >
              <span>{l === "en" ? "🇬🇧  English" : l === "fr" ? "🇫🇷  Français" : "🇸🇦  العربية"}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
