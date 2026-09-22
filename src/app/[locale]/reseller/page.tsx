import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Price } from "@/components/Price";
import { getResellerOrdersWithKeys } from "@/lib/reseller";
import { getSystemSettings } from "@/lib/settings";
import { CopyButton } from "@/components/CopyButton";
import type { Locale } from "@/i18n";

export default async function ResellerDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = locale as Locale;

  const session = await getSession();
  if (!session) redirect(`/${locale}/login?next=/${locale}/reseller`);
  if (session.role !== "RESELLER") redirect(`/${locale}/account`);

  const [user, wallet, orders, totalOrdersCount, settings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        tier: { select: { id: true, name: true, discountPercent: true } },
      },
    }),
    prisma.wallet.findUnique({ where: { userId: session.userId } }),
    getResellerOrdersWithKeys(session.userId),
    prisma.order.count({ where: { userId: session.userId } }),
    getSystemSettings(),
  ]);

  const tier = user?.tier;
  const balanceCents = Number(wallet?.balanceMinor ?? 0n);
  const recentOrders = orders.slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-[var(--surface)] to-[var(--surface-2)] p-6 shadow-[var(--elev-1)] sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-3xl text-white shadow-md">
              ⭐
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  Wholesale Partner Portal
                </span>
                <span className="text-xs font-medium text-[var(--fg-muted)]">
                  {tier?.discountPercent ? `${tier.discountPercent}% Discount` : "Active"}
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--fg)]">
                Welcome back, {tier?.name ?? "Reseller"} Partner
              </h1>
              {user?.email && (
                <p className="text-xs text-[var(--fg-muted)]" dir="ltr">
                  {user.email}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/${locale}/reseller/rates`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 text-xs font-bold text-emerald-700 shadow-xs transition-all duration-200 hover:bg-emerald-500 hover:text-white dark:text-emerald-300 active:scale-95"
            >
              <span>📋</span> Rate Sheet
            </Link>
            <Link
              href={`/${locale}/wallet`}
              className="inline-flex h-10 items-center justify-center rounded-full bg-[var(--accent)] px-5 text-xs font-bold text-white shadow-xs transition-all duration-200 hover:bg-[var(--accent-hover)] active:scale-95"
            >
              + Top-up Balance
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Wallet Balance */}
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--elev-1)]">
          <p className="text-xs font-semibold text-[var(--fg-muted)]">Wholesale Wallet Balance</p>
          <div className="mt-2 text-2xl font-black tracking-tight text-[var(--fg)]">
            <Price cents={balanceCents} locale={loc} size="lg" />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-[var(--fg-faint)]">
              Rate: {settings.dzdRate} DZD / USD
            </span>
            <Link
              href={`/${locale}/wallet`}
              className="text-xs font-bold text-[var(--accent)] hover:underline"
            >
              Add funds →
            </Link>
          </div>
        </div>

        {/* Wholesale Tier Privileges */}
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--elev-1)]">
          <p className="text-xs font-semibold text-[var(--fg-muted)]">Active Tier & Discount</p>
          <div className="mt-2 text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
            {tier?.discountPercent ? `${tier.discountPercent}% Off` : "Active"}
          </div>
          <p className="mt-3 text-xs text-[var(--fg-muted)]">
            Wholesale pricing automatically applied across the storefront.
          </p>
        </div>

        {/* Total Wholesale Orders */}
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--elev-1)]">
          <p className="text-xs font-semibold text-[var(--fg-muted)]">Total Orders Placed</p>
          <div className="mt-2 text-2xl font-black tracking-tight text-[var(--fg)]">
            {totalOrdersCount}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-[var(--fg-faint)]">Digital deliveries</span>
            <Link
              href={`/${locale}/reseller/orders`}
              className="text-xs font-bold text-[var(--accent)] hover:underline"
            >
              View orders →
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Deliveries & 1-Click Key Copier */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)] sm:p-8">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div>
            <h2 className="text-base font-bold tracking-tight text-[var(--fg)]">
              Recent Wholesale Deliveries
            </h2>
            <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
              Fast credential copying for instant client forwarding on WhatsApp or Telegram.
            </p>
          </div>
          <Link
            href={`/${locale}/reseller/orders`}
            className="text-xs font-bold text-[var(--accent)] hover:underline"
          >
            All Orders ({totalOrdersCount}) →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-[var(--fg-muted)]">No wholesale orders placed yet.</p>
            <Link
              href={`/${locale}/products`}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-[var(--accent)] px-5 text-xs font-bold text-white shadow-xs transition-all hover:bg-[var(--accent-hover)]"
            >
              Browse Catalog with Wholesale Rates
            </Link>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {recentOrders.map((o) => (
              <li
                key={o.id}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 transition-all hover:border-[var(--border-strong)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[var(--fg)]" dir="ltr">
                      {o.orderCode}
                    </span>
                    <span className="text-xs font-medium text-[var(--fg-muted)]">
                      · {o.productName} ({o.variantLabel})
                      {o.quantity > 1 && ` × ${o.quantity}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      {o.status}
                    </span>
                    <span className="text-xs font-bold">
                      <Price cents={o.totalMinor} locale={loc} size="sm" />
                    </span>
                  </div>
                </div>

                {/* Delivered Key / Credential Box */}
                {o.deliveredPayload && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <div className="min-w-0 flex-1 truncate font-mono text-xs select-all text-[var(--fg)]">
                      <span className="select-none text-[var(--fg-faint)]">🔑 Delivered: </span>
                      {o.deliveredPayload}
                    </div>
                    <CopyButton text={o.deliveredPayload} label="Copy Credentials" />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

