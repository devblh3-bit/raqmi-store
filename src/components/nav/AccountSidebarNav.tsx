"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
};

export function AccountSidebarNav({ locale }: { locale: string }) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      href: `/${locale}/account`,
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
          className={active ? "text-[var(--accent)]" : "text-[var(--fg-muted)]"}
        >
          <rect width={7} height={9} x={3} y={3} rx={1} />
          <rect width={7} height={5} x={14} y={3} rx={1} />
          <rect width={7} height={9} x={14} y={12} rx={1} />
          <rect width={7} height={5} x={3} y={16} rx={1} />
        </svg>
      ),
    },
    {
      href: `/${locale}/account/wallet`,
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
          className={active ? "text-[var(--accent)]" : "text-[var(--fg-muted)]"}
        >
          <rect width={20} height={14} x={2} y={5} rx={2} />
          <line x1={2} x2={22} y1={10} y2={10} />
        </svg>
      ),
    },
    {
      href: `/${locale}/account#orders`,
      label: "My Orders",
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
          className={active ? "text-[var(--accent)]" : "text-[var(--fg-muted)]"}
        >
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      ),
    },
    {
      href: `/${locale}/account#reseller`,
      label: "Become a Reseller",
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
          className={active ? "text-[var(--accent)]" : "text-[var(--fg-muted)]"}
        >
          <path d="m4.5 16.5-1.5 3 3-1.5" />
          <path d="m15 5 4 4" />
          <path d="M9.5 14.5 18 6c1.5-1.5 2-3.5 1-4.5s-3-.5-4.5 1l-8.5 8.5" />
          <path d="m13.5 10.5 4 4" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="mt-3 flex flex-col gap-1" aria-label="Customer Sidebar Navigation">
      {navItems.map((item) => {
        const isOverview = item.href === `/${locale}/account`;
        const isWallet = item.href === `/${locale}/account/wallet`;
        const isActive = isWallet
          ? pathname === item.href
          : isOverview
          ? pathname === item.href
          : false;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-150 ${
              isActive
                ? "bg-[var(--accent-soft)] text-[var(--accent)] font-bold border-l-2 border-[var(--accent)]"
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
