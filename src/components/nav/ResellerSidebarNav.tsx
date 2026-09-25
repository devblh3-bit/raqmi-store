"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
};

export function ResellerSidebarNav({ locale }: { locale: string }) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      href: `/${locale}/reseller`,
      label: "Overview",
      icon: (active) => (
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={active ? 2.2 : 1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={active ? "text-emerald-500" : "text-[var(--fg-muted)]"}
        >
          <rect width={7} height={9} x={3} y={3} rx={1} />
          <rect width={7} height={5} x={14} y={3} rx={1} />
          <rect width={7} height={9} x={14} y={12} rx={1} />
          <rect width={7} height={5} x={3} y={16} rx={1} />
        </svg>
      ),
    },
    {
      href: `/${locale}/reseller/rates`,
      label: "Wholesale Rates",
      icon: (active) => (
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={active ? 2.2 : 1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={active ? "text-emerald-500" : "text-[var(--fg-muted)]"}
        >
          <path d="m3.85 8.62 4.6-4.6a2 2 0 0 1 2.83 0l7.1 7.1a2 2 0 0 1 0 2.83l-4.6 4.6a2 2 0 0 1-2.83 0l-7.1-7.1a2 2 0 0 1 0-2.83Z" />
          <line x1={4} y1={4} x2={4.01} y2={4} />
          <path d="m14 7 3 3" />
        </svg>
      ),
    },
    {
      href: `/${locale}/reseller/orders`,
      label: "Orders & Keys",
      icon: (active) => (
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={active ? 2.2 : 1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={active ? "text-emerald-500" : "text-[var(--fg-muted)]"}
        >
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      ),
    },
    {
      href: `/${locale}/reseller/wallet`,
      label: "Wallet & Top-up",
      icon: (active) => (
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={active ? 2.2 : 1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={active ? "text-emerald-500" : "text-[var(--fg-muted)]"}
        >
          <rect width={20} height={14} x={2} y={5} rx={2} />
          <line x1={2} x2={22} y1={10} y2={10} />
        </svg>
      ),
    },
  ];

  return (
    <nav className="mt-3 flex flex-col gap-1" aria-label="Reseller Sidebar Navigation">
      {navItems.map((item) => {
        // Active if exact match or if current pathname starts with item.href (for sub-routes)
        const isOverview = item.href === `/${locale}/reseller`;
        const isActive = isOverview
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-150 ${
              isActive
                ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 font-bold border-l-2 border-emerald-500"
                : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
            }`}
          >
            <span className="shrink-0 transition-transform group-hover:scale-105">
              {item.icon(isActive)}
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
