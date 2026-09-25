import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import AccountMobileNav from "@/components/nav/AccountMobileNav";
import { AccountSidebarNav } from "@/components/nav/AccountSidebarNav";

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login?next=/${locale}/account`);

  if (session.role === "ADMIN") redirect(`/${locale}/admin`);
  if (session.role === "RESELLER") redirect(`/${locale}/reseller`);

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      email: true,
      role: true,
    },
  });

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 md:flex-row">
      {/* Mobile Top Customer Header */}
      <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xs md:hidden">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--accent)]">
            👤 Client
          </span>
          {user?.email && (
            <span className="max-w-[130px] truncate text-[11px] font-medium text-[var(--fg-faint)] sm:max-w-[200px]" dir="ltr">
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
      <aside className="sticky top-20 self-start hidden w-52 shrink-0 md:block">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--accent)]">
              👤 Customer Portal
            </span>
            <Link
              href={`/${locale}`}
              className="text-[11px] font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] transition"
              title="Return to Storefront"
            >
              Store ↗
            </Link>
          </div>

          {user?.email && (
            <p className="mt-3 truncate font-mono text-[11px] text-[var(--fg-muted)]" dir="ltr">
              {user.email}
            </p>
          )}

          <AccountSidebarNav locale={locale} />

          <div className="mt-5 border-t border-[var(--border)] pt-3">
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
              >
                <svg
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
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

      {/* Main Content Pane */}
      <div className="min-w-0 flex-1 pb-20 md:pb-0">{children}</div>
      <AccountMobileNav locale={locale} />
    </div>
  );
}

