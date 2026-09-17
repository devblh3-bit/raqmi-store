"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Locale } from "@/i18n";

const navKeys = [
  { key: "products", href: "/products" },
  { key: "categories", href: "/categories" },
  { key: "promo", href: "/promo" },
  { key: "track", href: "/track-order" },
] as const;

export default function Header({ locale }: { locale: Locale }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const prefix = `/${locale}`;

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--surface)]/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href={prefix} className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--fg)] text-[11px] font-black tracking-widest text-white">
            RQ
          </span>
          <span className="text-sm font-bold tracking-tight">Raqmi</span>
          <span className="hidden text-xs font-medium text-[var(--fg-faint)] sm:inline">Store</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navKeys.map((n) => (
            <Link
              key={n.key}
              href={`${prefix}${n.href}`}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
            >
              {t(n.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-1 sm:flex">
            {(["en", "fr", "ar"] as Locale[]).map((l) => (
              <Link
                key={l}
                href={`/${l}`}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${l === locale ? "bg-[var(--fg)] text-white" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}
              >
                {l.toUpperCase()}
              </Link>
            ))}
          </div>
          <Link
            href={`${prefix}/cart`}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3.5 py-2 text-sm font-semibold shadow-sm transition-all hover:shadow-md"
          >
            <span aria-hidden>🛒</span>
            {t("cart")}
          </Link>
          <button
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white md:hidden"
          >
            <span className="text-sm">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[var(--border)] bg-white px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {navKeys.map((n) => (
              <Link
                key={n.key}
                href={`${prefix}${n.href}`}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2 text-sm font-medium text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
              >
                {t(n.key)}
              </Link>
            ))}
            <div className="mt-2 flex gap-1">
              {(["en", "fr", "ar"] as Locale[]).map((l) => (
                <Link
                  key={l}
                  href={`/${l}`}
                  className={`flex-1 rounded-full px-3 py-2 text-center text-sm font-semibold ${l === locale ? "bg-[var(--fg)] text-white" : "border border-[var(--border)] bg-white"}`}
                >
                  {l.toUpperCase()}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
