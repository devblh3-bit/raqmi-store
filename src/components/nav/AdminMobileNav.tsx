"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminMobileNav({ locale }: { locale: string }) {
  const pathname = usePathname();
  const [openMore, setOpenMore] = useState(false);
  const [prevPath, setPrevPath] = useState(pathname);

  // Adjust state during render when pathname changes
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setOpenMore(false);
  }

  // Close drawer on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMore(false);
    }
    if (openMore) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openMore]);

  const primaryItems = [
    {
      href: `/${locale}/admin`,
      label: "Dashboard",
      icon: (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect width={7} height={9} x={3} y={3} rx={1} />
          <rect width={7} height={5} x={14} y={3} rx={1} />
          <rect width={7} height={9} x={14} y={12} rx={1} />
          <rect width={7} height={5} x={3} y={16} rx={1} />
        </svg>
      ),
      isActive: pathname === `/${locale}/admin`,
    },
    {
      href: `/${locale}/admin/catalog`,
      label: "Catalog",
      icon: (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      ),
      isActive: pathname?.startsWith(`/${locale}/admin/catalog`),
    },
    {
      href: `/${locale}/admin/orders`,
      label: "Orders",
      icon: (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      ),
      isActive: pathname?.startsWith(`/${locale}/admin/orders`),
    },
    {
      href: `/${locale}/admin/users`,
      label: "Users",
      icon: (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx={9} cy={7} r={4} />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      isActive: pathname?.startsWith(`/${locale}/admin/users`),
    },
  ];

  const secondaryItems = [
    { href: `/${locale}/admin/categories`, label: "Categories", icon: "🗂️" },
    { href: `/${locale}/admin/resellers`, label: "Resellers", icon: "⭐" },
    { href: `/${locale}/admin/deposits`, label: "Deposits", icon: "💳" },
    { href: `/${locale}/admin/audit`, label: "Audit Logs", icon: "📜" },
    { href: `/${locale}/admin/notifications`, label: "Notifications", icon: "🔔" },
    { href: `/${locale}/admin/sync`, label: "Sync", icon: "🔄" },
    { href: `/${locale}/admin/settings`, label: "Settings", icon: "⚙️" },
  ];

  const isSecondaryActive = secondaryItems.some((item) => pathname?.startsWith(item.href));

  return (
    <>
      {/* Expandable "More" Bottom Sheet Drawer */}
      {openMore && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
          {/* Backdrop with light dismiss */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setOpenMore(false)}
            aria-hidden
          />

          {/* Drawer Content */}
          <div className="relative z-10 max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl pb-[max(2rem,env(safe-area-inset-bottom,0px))]">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[var(--border)]" />
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <span className="text-sm font-bold tracking-tight text-[var(--fg)]">Admin Management</span>
              <button
                type="button"
                onClick={() => setOpenMore(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {secondaryItems.map((item) => {
                const active = pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpenMore(false)}
                    className={`flex items-center gap-2.5 rounded-2xl p-3 text-xs font-semibold transition-all active:scale-95 ${
                      active
                        ? "bg-[var(--accent)] text-white shadow-xs font-bold"
                        : "bg-[var(--surface-2)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                    }`}
                  >
                    <span className="text-base leading-none">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4">
              <Link
                href={`/${locale}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--surface-2)] px-3.5 py-2 text-xs font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                Storefront ↗
              </Link>

              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-xl bg-red-500/10 px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-500/20 dark:text-red-400"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Primary Fixed Bottom App Bar */}
      <nav
        aria-label="Admin Mobile Navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-lg pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-1 md:hidden"
      >
        <div className="mx-auto flex max-w-md items-center justify-around px-2">
          {primaryItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpenMore(false)}
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

          {/* "More" Trigger */}
          <button
            type="button"
            onClick={() => setOpenMore((prev) => !prev)}
            aria-expanded={openMore}
            className={`flex flex-1 flex-col items-center justify-center py-1 text-center transition-all duration-150 active:scale-95 ${
              openMore || isSecondaryActive
                ? "text-[var(--accent)] font-bold"
                : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
            }`}
          >
            <span className="relative flex h-6 w-6 items-center justify-center">
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx={12} cy={12} r={1} />
                <circle cx={19} cy={12} r={1} />
                <circle cx={5} cy={12} r={1} />
              </svg>
              {isSecondaryActive && !openMore && (
                <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              )}
            </span>
            <span className="mt-0.5 text-[11px] leading-tight">
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
