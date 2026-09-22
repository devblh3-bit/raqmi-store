import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import AdminMobileNav from "@/components/nav/AdminMobileNav";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login?next=/${locale}/admin`);
  if (session.role !== "ADMIN") redirect(`/${locale}/login?next=/${locale}/admin`);

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });

  const nav = [
    { href: `/${locale}/admin`, label: "Dashboard" },
    { href: `/${locale}/admin/catalog`, label: "Catalog" },
    { href: `/${locale}/admin/categories`, label: "Categories" },
    { href: `/${locale}/admin/orders`, label: "Orders" },
    { href: `/${locale}/admin/users`, label: "Customers" },
    { href: `/${locale}/admin/resellers`, label: "Resellers" },
    { href: `/${locale}/admin/deposits`, label: "Deposits" },
    { href: `/${locale}/admin/audit`, label: "Audit Logs" },
    { href: `/${locale}/admin/notifications`, label: "Notifications" },
    { href: `/${locale}/admin/sync`, label: "Sync" },
    { href: `/${locale}/admin/settings`, label: "Settings" },
  ] as const;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 md:flex-row">
      {/* Mobile Top Admin Header */}
      <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xs md:hidden">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent)]">
            🛡️ Admin
          </span>
          {user?.email && (
            <span className="max-w-[140px] truncate text-[11px] font-medium text-[var(--fg-faint)] sm:max-w-[200px]" dir="ltr">
              {user.email}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}`}
            className="text-[11px] font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]"
          >
            Store ↗
          </Link>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-400"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>

      {/* Desktop Sticky Sidebar */}
      <aside className="sticky top-20 self-start hidden w-48 shrink-0 md:block">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--accent)]">
              🛡️ Admin
            </span>
            <Link
              href={`/${locale}`}
              className="text-[11px] font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]"
              title="Return to Storefront"
            >
              Store ↗
            </Link>
          </div>

          {user?.email && (
            <p className="mt-2 truncate text-[11px] font-medium text-[var(--fg-faint)]" dir="ltr" title={user.email}>
              {user.email}
            </p>
          )}

          <nav className="mt-3 flex flex-col gap-1">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-xl px-3 py-2 text-sm font-medium text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 pb-20 md:pb-0">{children}</main>
      <AdminMobileNav locale={locale} />
    </div>
  );
}
