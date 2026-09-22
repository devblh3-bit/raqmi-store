"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCart } from "@/components/CartProvider";
import type { Locale } from "@/i18n";

export default function StoreMobileNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { items } = useCart();

  const totalCartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Suppress storefront bottom bar when inside dedicated management portals
  const isPortal =
    pathname?.startsWith(`/${locale}/admin`) ||
    pathname?.startsWith(`/${locale}/reseller`) ||
    pathname?.startsWith(`/${locale}/account`);

  if (isPortal) {
    return null;
  }

  const navItems = [
    {
      href: `/${locale}`,
      label: t("home"),
      icon: (
        <svg
          width={20}
          height={20}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
      isActive: pathname === `/${locale}`,
    },
    {
      href: `/${locale}/products`,
      label: t("products"),
      icon: (
        <svg
          width={20}
          height={20}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      ),
      isActive:
        pathname === `/${locale}/products` ||
        pathname?.startsWith(`/${locale}/products/`) ||
        pathname?.startsWith(`/${locale}/categories`),
    },
    {
      href: `/${locale}/cart`,
      label: t("cart"),
      icon: (
        <div className="relative">
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M6 6h15l-1.5 9H6z" />
            <path d="M6 6 5 2H2" />
            <circle cx={9} cy={20} r={1.7} fill="currentColor" stroke="none" />
            <circle cx={18} cy={20} r={1.7} fill="currentColor" stroke="none" />
          </svg>
          {totalCartCount > 0 && (
            <span
              className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-black text-white shadow-xs"
              aria-label={`${totalCartCount} items in cart`}
            >
              {totalCartCount > 99 ? "99+" : totalCartCount}
            </span>
          )}
        </div>
      ),
      isActive: pathname === `/${locale}/cart`,
    },
    {
      href: `/${locale}/account`,
      label: t("account"),
      icon: (
        <svg
          width={20}
          height={20}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx={12} cy={8} r={4} />
          <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
        </svg>
      ),
      isActive: pathname === `/${locale}/account` || pathname === `/${locale}/login`,
    },
  ];

  return (
    <nav
      aria-label="Storefront Mobile Navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-lg pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-1 md:hidden"
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center justify-center py-1 text-center transition-all duration-150 active:scale-95 ${
              item.isActive
                ? "text-[var(--accent)] font-bold"
                : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
            }`}
          >
            <span className="flex h-6 w-6 items-center justify-center">
              {item.icon}
            </span>
            <span className="mt-0.5 text-[11px] leading-tight">
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

