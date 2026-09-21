import { prisma } from "@/lib/db";
import { toggleProviderActive, updateLowBalanceThreshold, refreshProviderBalance } from "./actions";

export default async function SyncPage() {
  const [providers, syncRuns] = await Promise.all([
    prisma.provider.findMany({
      select: {
        id: true,
        code: true,
        displayName: true,
        isActive: true,
        balanceMinor: true,
        balanceCurrency: true,
        lowBalanceThresholdMinor: true,
      },
    }),
    prisma.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 }),
  ]);

  async function triggerSync(formData: FormData) {
    "use server";
    const { syncProvider } = await import("@/lib/catalog/sync");
    const code = String(formData.get("code") ?? "");
    await syncProvider(code);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Sync</h1>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Providers</h2>
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {providers.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {p.displayName} <span className="font-mono text-xs text-[var(--fg-muted)]">({p.code})</span>
                </p>
                <p className="text-xs text-[var(--fg-muted)]">
                  {p.isActive ? "Active" : "Inactive"}
                  {p.balanceMinor != null ? ` · balance ${p.balanceCurrency ?? ""} ${(Number(p.balanceMinor) / 100).toFixed(2)}` : " · balance —"}
                  {p.lowBalanceThresholdMinor != null ? ` · threshold ${(Number(p.lowBalanceThresholdMinor) / 100).toFixed(2)}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <form action={toggleProviderActive}>
                    <input type="hidden" name="providerId" value={p.id} />
                    <button className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold hover:bg-[var(--surface-2)]">
                      {p.isActive ? "Disable" : "Enable"}
                    </button>
                  </form>
                  <form action={refreshProviderBalance}>
                    <input type="hidden" name="providerId" value={p.id} />
                    <button className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold hover:bg-[var(--surface-2)]">Refresh balance</button>
                  </form>
                  <form action={updateLowBalanceThreshold} className="flex items-center gap-1">
                    <input type="hidden" name="providerId" value={p.id} />
                    <input
                      name="threshold"
                      defaultValue={p.lowBalanceThresholdMinor?.toString() ?? ""}
                      placeholder="threshold minor"
                      className="w-28 rounded-lg border border-[var(--border)] px-2 py-1 font-mono text-xs outline-none focus:border-[var(--accent)]"
                    />
                    <button className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold hover:bg-[var(--surface-2)]">Save</button>
                  </form>
                </div>
              </div>
              <form action={triggerSync}>
                <input type="hidden" name="code" value={p.code} />
                <button className="shrink-0 rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-bold text-white hover:bg-[var(--accent-hover)]">
                  Sync now
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Recent sync runs</h2>
        {syncRuns.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--fg-muted)]">No sync runs yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {syncRuns.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] py-2 last:border-0">
                <span className="font-mono text-xs text-[var(--fg-muted)]">
                  {r.startedAt.toISOString().slice(0, 19).replace("T", " ")} · {r.providerId.slice(0, 6)}…
                </span>
                <span className="text-xs text-[var(--fg-muted)]">
                  +{r.inserted} / ~{r.updated} {r.errors ? `· ${r.errors} err` : "· ok"}
                  {r.errorText ? ` · ${r.errorText.slice(0, 80)}` : ""}
                  {r.finishedAt ? "" : " · running"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-[var(--fg-muted)]">
        Cron: <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono">POST /api/cron/sync-providers</code> with{" "}
        <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono">x-cron-secret</code> header. Balances:{" "}
        <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono">POST /api/cron/poll-balances</code> every 5 min.
      </p>
    </div>
  );
}
