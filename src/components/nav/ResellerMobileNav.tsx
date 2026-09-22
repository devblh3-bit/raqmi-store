"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ResellerMobileNav({ locale }: { locale: string }) {
  const pathname = usePathname();

  const navItems = [
    {
      href: `/${locale}/reseller`,
      label: "Overview",
      icon: (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect width={7} height={9} x={3} y={3} rx={1} />
          <rect width={7} height={5} x={14} y={3} rx={1} />
          <rect width={7} height={9} x={14} y={12} rx={1} />
          <rect width={7} height={5} x={3} y={16} rx={1} />
        </svg>
      ),
      isActive: pathname === `/${locale}/reseller`,
    },
    {
      href: `/${locale}/reseller/rates`,
      label: "Rates",
      icon: (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m3.85 8.62 4.6-4.6a2 2 0 0 1 2.83 0l7.1 7.1a2 2 0 0 1 0 2.83l-4.6 4.6a2 2 0 0 1-2.83 0l-7.1-7.1a2 2 0 0 1 0-2.83Z" />
          <path d="m14 7 3 3" />
        </svg>
      ),
      isActive: pathname === `/${locale}/reseller/rates`,
    },
    {
      href: `/${locale}/reseller/orders`,
      label: "Orders",
      icon: (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      ),
      isActive: pathname === `/${locale}/reseller/orders`,
    },
    {
      href: `/${locale}/reseller/wallet`,
      label: "Wallet",
      icon: (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect width={20} height={14} x={2} y={5} rx={2} />
          <line x1={2} x2={22} y1={10} y2={10} />
        </svg>
      ),
      isActive: pathname === `/${locale}/reseller/wallet`,
    },
  ];

  return (
    <nav
      aria-label="Reseller Mobile Navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-lg pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-1 md:hidden"
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center justify-center py-1 text-center transition-all duration-150 active:scale-95 ${
              item.isActive
                ? "text-emerald-600 dark:text-emerald-400 font-bold"
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

