import { prisma } from "@/lib/db";

export default async function AdminDashboard() {
  const [offerCount, providerOfferCount, syncRuns, orderCount] = await Promise.all([
    prisma.offer.count(),
    prisma.providerOffer.count(),
    prisma.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 5 }),
    prisma.order.count(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Offers" value={offerCount} />
        <Stat label="Provider SKUs" value={providerOfferCount} />
        <Stat label="Orders" value={orderCount} />
        <Stat label="Sync runs" value={syncRuns.length} />
      </div>

      {syncRuns.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Recent sync runs</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {syncRuns.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-[var(--fg-muted)]">
                <span className="font-mono text-xs">{r.id.slice(0, 8)}… {r.providerId.slice(0, 6)}</span>
                <span>
                  +{r.inserted} / ~{r.updated} {r.errors ? `· ${r.errors} err` : ""}
                  {r.finishedAt ? "" : " · running"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <p className="text-xs font-medium text-[var(--fg-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
