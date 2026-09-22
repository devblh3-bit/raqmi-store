import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { getSystemSettings } from "@/lib/settings";

async function loadDashboardMetrics() {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return Promise.all([
    prisma.wallet.aggregate({ _sum: { balanceMinor: true } }),
    prisma.order.findMany({
      where: { createdAt: { gte: last24h }, paymentStatus: "PAID" },
      select: { totalMinor: true },
    }),
    prisma.deposit.count({ where: { status: "PENDING" } }),
    prisma.orderItem.count({
      where: { status: { in: ["FAILED", "AWAITING_FULFILLMENT"] } },
    }),
    prisma.user.count({ where: { role: "RESELLER_APPLICANT" } }),
    prisma.provider.findMany({
      where: { isActive: true },
      select: {
        id: true,
        displayName: true,
        code: true,
        balanceMinor: true,
        balanceCurrency: true,
        lowBalanceThresholdMinor: true,
      },
    }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.offer.count({ where: { isActive: true } }),
    prisma.providerOffer.count({ where: { availability: "OUT_OF_STOCK" } }),
    prisma.user.count({ where: { role: "RESELLER" } }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        user: { select: { email: true } },
        items: {
          select: {
            id: true,
            status: true,
            quantity: true,
            offer: { select: { labelEn: true } },
          },
        },
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        actor: { select: { email: true } },
      },
    }),
    prisma.syncRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 3,
      include: { provider: { select: { displayName: true } } },
    }),
  ]);
}

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale);

  const [
    settings,
    [
      walletSum,
      recentPaidOrders,
      pendingDepositsCount,
      failedItemsCount,
      pendingApplicantsCount,
      providers,
      productCount,
      offerCount,
      oosOfferCount,
      resellerCount,
      recentOrders,
      recentAuditLogs,
      syncRuns,
    ],
  ] = await Promise.all([getSystemSettings(), loadDashboardMetrics()]);

  const dzdRate = settings.dzdRate;

  const sales24hMinor = recentPaidOrders.reduce((sum, o) => sum + o.totalMinor, 0n);
  const sales24hUsd = Number(sales24hMinor) / 100;
  const walletLiabilityMinor = walletSum._sum.balanceMinor ?? 0n;
  const walletLiabilityUsd = Number(walletLiabilityMinor) / 100;

  const lowBalanceProviders = providers.filter((p) => {
    if (p.balanceMinor === null || p.lowBalanceThresholdMinor === null) return false;
    return p.balanceMinor <= p.lowBalanceThresholdMinor;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Executive Command Center</h1>
        <p className="text-sm text-[var(--fg-muted)] mt-1">
          Real-time snapshot of sales volume, platform liabilities, operational alerts, and catalog telemetry.
        </p>
      </div>

      {/* Operational Attention Banners */}
      <div className="space-y-2">
        {pendingDepositsCount > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <span>💳</span>
              <span>
                <strong>{pendingDepositsCount} pending deposit{pendingDepositsCount > 1 ? "s" : ""}</strong> awaiting payment verification & credit approval.
              </span>
            </div>
            <Link
              href={`/${locale}/admin/deposits`}
              className="font-bold underline hover:opacity-80"
            >
              Review Deposits →
            </Link>
          </div>
        )}

        {failedItemsCount > 0 && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-400 flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <span>⚠️</span>
              <span>
                <strong>{failedItemsCount} order item{failedItemsCount > 1 ? "s" : ""}</strong> stalled or failed fulfillment, requiring manual keys or wallet refund.
              </span>
            </div>
            <Link
              href={`/${locale}/admin/orders?status=FAILED`}
              className="font-bold underline hover:opacity-80"
            >
              Resolve Orders →
            </Link>
          </div>
        )}

        {pendingApplicantsCount > 0 && (
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-xs text-purple-700 dark:text-purple-400 flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <span>🤝</span>
              <span>
                <strong>{pendingApplicantsCount} user{pendingApplicantsCount > 1 ? "s" : ""}</strong> applied for wholesale reseller partnership.
              </span>
            </div>
            <Link
              href={`/${locale}/admin/resellers`}
              className="font-bold underline hover:opacity-80"
            >
              Review Applicants →
            </Link>
          </div>
        )}

        {lowBalanceProviders.length > 0 && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-400 flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <span>🚨</span>
              <span>
                Low balance warning on suppliers:{" "}
                <strong>{lowBalanceProviders.map((p) => p.displayName).join(", ")}</strong>.
              </span>
            </div>
            <Link
              href={`/${locale}/admin/sync`}
              className="font-bold underline hover:opacity-80"
            >
              Check Provider Balances →
            </Link>
          </div>
        )}
      </div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider">
            24h Sales Volume
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            ${sales24hUsd.toFixed(2)}
          </div>
          <div className="text-[11px] text-[var(--fg-muted)]">
            {recentPaidOrders.length} orders · ≈ {Math.round(sales24hUsd * dzdRate).toLocaleString()} DZD
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider">
            Wallet Liability
          </div>
          <div className="text-2xl font-bold text-[var(--fg)]">
            ${walletLiabilityUsd.toFixed(2)}
          </div>
          <div className="text-[11px] text-[var(--fg-muted)]">
            Customer balances · ≈ {Math.round(walletLiabilityUsd * dzdRate).toLocaleString()} DZD
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider">
            Catalog Health
          </div>
          <div className="text-2xl font-bold text-[var(--fg)]">
            {offerCount} <span className="text-xs font-normal text-[var(--fg-muted)]">offers</span>
          </div>
          <div className="text-[11px] text-[var(--fg-muted)]">
            {productCount} products ·{" "}
            <span className={oosOfferCount > 0 ? "text-rose-500 font-semibold" : ""}>
              {oosOfferCount} out of stock
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider">
            Reseller Network
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {resellerCount} <span className="text-xs font-normal text-[var(--fg-muted)]">active</span>
          </div>
          <div className="text-[11px] text-[var(--fg-muted)]">
            {pendingApplicantsCount} pending review
          </div>
        </div>
      </div>

      {/* Provider Balances Row */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--fg-muted)]">
            Upstream Supplier Wholesale Balances
          </h2>
          <Link href={`/${locale}/admin/sync`} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
            Manage Sync →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {providers.map((p) => {
            const bal = p.balanceMinor !== null ? Number(p.balanceMinor) / 100 : null;
            const isLow =
              p.balanceMinor !== null &&
              p.lowBalanceThresholdMinor !== null &&
              p.balanceMinor <= p.lowBalanceThresholdMinor;

            return (
              <div
                key={p.id}
                className={`rounded-xl border p-3.5 space-y-1 ${
                  isLow
                    ? "border-rose-500/40 bg-rose-500/5"
                    : "border-[var(--border)] bg-[var(--surface-2)]/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[var(--fg)]">{p.displayName}</span>
                  <span className="font-mono text-[10px] text-[var(--fg-muted)]">{p.code}</span>
                </div>
                <div className="font-mono text-lg font-bold">
                  {bal !== null ? `$${bal.toFixed(2)}` : "—"}{" "}
                  <span className="text-xs font-normal text-[var(--fg-muted)]">
                    {p.balanceCurrency ?? "USD"}
                  </span>
                </div>
                {isLow && (
                  <div className="text-[10px] font-bold text-rose-500">
                    ⚠️ Below threshold (${(Number(p.lowBalanceThresholdMinor) / 100).toFixed(0)})
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--fg)]">Recent Orders</h2>
            <Link href={`/${locale}/admin/orders`} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
              All Orders →
            </Link>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {recentOrders.map((o) => (
              <div key={o.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[var(--fg)]">{o.code}</span>
                    <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold">
                      {o.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--fg-muted)] mt-0.5">
                    {o.user?.email ?? o.guestEmail ?? "Guest"} · {o.items.length} item(s)
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold">${(Number(o.totalMinor) / 100).toFixed(2)}</div>
                  <div className="text-[10px] text-[var(--fg-muted)]">{o.createdAt.toISOString().slice(0, 10)}</div>
                </div>
              </div>
            ))}

            {recentOrders.length === 0 && (
              <div className="py-6 text-center text-xs text-[var(--fg-muted)]">No orders yet.</div>
            )}
          </div>
        </div>

        {/* Recent Administrative Audit Activity */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--fg)]">Audit Activity</h2>
            <Link href={`/${locale}/admin/audit`} className="text-xs text-purple-600 dark:text-purple-400 hover:underline">
              Audit Explorer →
            </Link>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {recentAuditLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      {log.action}
                    </span>
                    <span className="text-[11px] text-[var(--fg-muted)]">{log.entity}</span>
                  </div>
                  <div className="text-[11px] text-[var(--fg-muted)] mt-0.5">
                    By {log.actor?.email ?? "System"}
                  </div>
                </div>

                <div className="text-right text-[10px] text-[var(--fg-muted)] font-mono">
                  {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}

            {recentAuditLogs.length === 0 && (
              <div className="py-6 text-center text-xs text-[var(--fg-muted)]">No audit activity logged.</div>
            )}
          </div>
        </div>
      </div>

      {/* Sync Telemetry */}
      {syncRuns.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
            Recent Provider Catalog Syncs
          </h2>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {syncRuns.map((r) => (
              <div key={r.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-2.5 space-y-1">
                <div className="flex justify-between font-medium">
                  <span>{r.provider.displayName}</span>
                  <span className="text-[var(--fg-muted)]">{r.finishedAt ? "✓ Completed" : "⚡ Running"}</span>
                </div>
                <div className="font-mono text-[11px] text-[var(--fg-muted)]">
                  +{r.inserted} inserted · ~{r.updated} updated · {r.errors} errors
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
