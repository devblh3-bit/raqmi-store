"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Locale } from "@/i18n";
import ThemeToggle from "./ThemeToggle";
import LocaleSwitcher from "./LocaleSwitcher";

const navKeys = [
  { key: "products", href: "/products" },
  { key: "categories", href: "/categories" },
  { key: "promo", href: "/promo" },
  { key: "track", href: "/track-order" },
] as const;

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props} aria-hidden>
      <circle cx={11} cy={11} r={8} />
      <path d="m21 21-4.34-4.34" />
    </svg>
  );
}

function UserIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx={12} cy={8} r={4} />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );
}

function CartIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M6 6h15l-1.5 9H6z" />
      <path d="M6 6 5 2H2" />
      <circle cx={9} cy={20} r={1.7} fill="currentColor" stroke="none" />
      <circle cx={18} cy={20} r={1.7} fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function Header({ locale }: { locale: Locale }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const prefix = `/${locale}`;

  return (
    <div className="sticky top-0 z-40 pt-3 sm:pt-4">
      <header className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex items-center justify-between gap-2 rounded-full px-3 py-2 shadow-[var(--elev-1)] transition-all duration-300 sm:px-4 mat-func">
          <Link href={prefix} className="group flex shrink-0 items-center gap-2 ps-1">
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--fg)] shadow-xs ring-1 ring-[var(--border)]/80 transition-transform duration-200 group-hover:scale-105">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="fill-current" aria-hidden>
                <path d="M15.914 4a1.5 1.5 0 0 0-2.474-1.561l-9 9A1.5 1.5 0 0 0 5.5 14h4.002a.5.5 0 0 1 .471.666L8.086 20a1.5 1.5 0 0 0 2.475 1.56l9-9A1.5 1.5 0 0 0 18.5 10h-3.997a.5.5 0 0 1-.472-.667z" />
              </svg>
            </span>
            <span className="text-[16px] font-bold tracking-tight text-[var(--fg)]">
              Raq<span className="text-[var(--accent)]">mi</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navKeys.map((n) => {
              const fullHref = `${prefix}${n.href}`;
              const isActive = pathname === fullHref || pathname?.startsWith(`${fullHref}/`);
              return (
                <Link
                  key={n.key}
                  href={fullHref}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] tracking-tight transition-all duration-200 ease-[var(--ease-premium)] ${
                    isActive
                      ? "btn-shine bg-[var(--accent)] text-white font-bold shadow-xs active:scale-95"
                      : "font-medium text-[var(--fg-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] active:scale-95"
                  }`}
                >
                  {t(n.key)}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              className="flex h-8 items-center gap-2 rounded-full bg-[var(--surface)]/60 px-3 text-[13px] text-[var(--fg-muted)] shadow-[inset_0_0_0_1px_var(--border)] backdrop-blur-md transition-all duration-200 hover:bg-[var(--surface)] hover:text-[var(--fg)] hover:shadow-[var(--elev-1)] sm:h-9 sm:w-40 sm:justify-between lg:w-48"
              aria-label="Search..."
            >
              <span className="flex items-center gap-2">
                <SearchIcon className="h-[14px] w-[14px]" />
                <span className="hidden sm:inline text-xs">Search...</span>
              </span>
              <kbd className="hidden rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--fg-faint)] sm:inline">/</kbd>
            </button>

            <LocaleSwitcher locale={locale} />

            <ThemeToggle />

            <Link
              href={`${prefix}/cart`}
              aria-label="Cart"
              className="relative hidden h-9 w-9 items-center justify-center rounded-full text-[var(--fg-muted)] transition-all duration-200 hover:bg-[var(--surface)]/80 hover:text-[var(--fg)] hover:shadow-[var(--elev-1)] active:scale-95 sm:flex"
            >
              <CartIcon className="h-[16px] w-[16px]" />
            </Link>

            {/* Always /account, never /login: this is a static client component and
                cannot read the session without making every page dynamic. /account
                itself redirects anonymous visitors to login, so one target serves
                both cases and the storefront stays prerendered. */}
            <Link
              href={`${prefix}/account`}
              aria-label={t("account")}
              className="relative hidden h-9 w-9 items-center justify-center rounded-full text-[var(--fg-muted)] transition-all duration-200 hover:bg-[var(--surface)]/80 hover:text-[var(--fg)] hover:shadow-[var(--elev-1)] active:scale-95 sm:flex"
            >
              <UserIcon className="h-[16px] w-[16px]" />
            </Link>

            <button
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--fg-muted)] transition-all duration-200 hover:bg-[var(--surface)]/80 hover:text-[var(--fg)] lg:hidden"
            >
              <span className="relative block h-3.5 w-3.5">
                <span className={`absolute left-0 top-0 h-0.5 w-3.5 rounded-full bg-current transition-all duration-300 ease-[var(--ease-premium)] ${open ? "translate-y-[5px] rotate-45" : ""}`} />
                <span className={`absolute left-0 top-[5px] h-0.5 w-3.5 rounded-full bg-current transition-all duration-200 ${open ? "opacity-0" : "opacity-100"}`} />
                <span className={`absolute left-0 top-[10px] h-0.5 w-3.5 rounded-full bg-current transition-all duration-300 ease-[var(--ease-premium)] ${open ? "-translate-y-[5px] -rotate-45" : ""}`} />
              </span>
            </button>
          </div>
        </div>

        {open && (
          <div className="mt-2 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--elev-3)] lg:hidden">
            <nav className="flex flex-col gap-1 p-1">
              {navKeys.map((n) => {
                const fullHref = `${prefix}${n.href}`;
                const isActive = pathname === fullHref || pathname?.startsWith(`${fullHref}/`);
                return (
                  <Link
                    key={n.key}
                    href={fullHref}
                    onClick={() => setOpen(false)}
                    className={`rounded-2xl px-4 py-3 text-sm tracking-tight transition-all duration-200 ${
                      isActive
                        ? "btn-shine bg-[var(--accent)] text-white font-bold shadow-xs active:scale-95"
                        : "font-medium text-[var(--fg-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] active:scale-95"
                    }`}
                  >
                    {t(n.key)}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>
    </div>
  );
}
