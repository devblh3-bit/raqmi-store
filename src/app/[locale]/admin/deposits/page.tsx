import Link from "next/link";
import { prisma } from "@/lib/db";
import { approveDepositAction, rejectDepositAction, verifyDepositOnChainAction } from "./actions";

export default async function DepositsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const { status } = await searchParams;
  const where =
    status === "PENDING" || status === "APPROVED" || status === "REJECTED" || status === "CONFIRMED_ON_CHAIN"
      ? { status: status as never }
      : { status: { in: ["PENDING", "CONFIRMED_ON_CHAIN"] as never[] } };

  const deposits = await prisma.deposit.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { email: true } } },
  });

  const tabs = ["", "PENDING", "CONFIRMED_ON_CHAIN", "APPROVED", "REJECTED"] as const;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Deposits</h1>

      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <Link
            key={t || "all"}
            href={t ? `/${locale}/admin/deposits?status=${t}` : `/${locale}/admin/deposits`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              (status ?? "") === t ? "bg-[var(--fg)] text-white" : "border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {t || "Pending (default)"}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        {/* Desktop View (Table) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-2)] text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              <tr>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Method</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Proof</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {deposits.map((d) => (
                <tr key={d.id} className="hover:bg-[var(--surface-2)]/50">
                  <td className="px-4 py-3 font-mono text-xs">{d.user.email}</td>
                  <td className="px-4 py-3 font-mono text-xs">${(Number(d.amountMinor) / 100).toFixed(2)}</td>
                  <td className="px-4 py-3 text-xs">{d.method}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs font-semibold">{d.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {d.proofImageUrl ? (
                      <a
                        href={d.proofImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-semibold text-[var(--accent)] hover:underline"
                      >
                        <img
                          src={d.proofImageUrl}
                          alt="Proof thumbnail"
                          className="h-8 w-8 rounded-lg object-cover border border-[var(--border)] shadow-xs"
                        />
                        <span>View Receipt ↗</span>
                      </a>
                    ) : d.txHash ? (
                      <a
                        href={
                          d.method === "USDT_BEP20"
                            ? `https://bscscan.com/tx/${d.txHash}`
                            : `https://tronscan.org/#/transaction/${d.txHash}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <span>{d.txHash.slice(0, 8)}…{d.txHash.slice(-4)}</span>
                        <span>↗</span>
                      </a>
                    ) : (
                      <span className="text-[var(--fg-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(d.status === "PENDING" || d.status === "CONFIRMED_ON_CHAIN") && (
                      <span className="inline-flex items-center gap-1.5">
                        {d.method === "USDT_BEP20" && d.txHash && (
                          <form
                            action={async (fd: FormData) => {
                              "use server";
                              await verifyDepositOnChainAction(fd);
                            }}
                          >
                            <input type="hidden" name="depositId" value={d.id} />
                            <button
                              title="Verify on-chain using NodeReal BSC RPC"
                              className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-blue-700 inline-flex items-center gap-1 shadow-xs"
                            >
                              <span>⚡</span>
                              <span>Verify</span>
                            </button>
                          </form>
                        )}
                        <form
                          action={async (fd: FormData) => {
                            "use server";
                            await approveDepositAction(fd);
                          }}
                        >
                          <input type="hidden" name="depositId" value={d.id} />
                          <button className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700">Approve</button>
                        </form>
                        <form
                          action={async (fd: FormData) => {
                            "use server";
                            await rejectDepositAction(fd);
                          }}
                        >
                          <input type="hidden" name="depositId" value={d.id} />
                          <button className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold hover:bg-[var(--surface-2)]">Reject</button>
                        </form>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {deposits.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--fg-muted)]">No deposits in this filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View (Cards) */}
        <div className="md:hidden divide-y divide-[var(--border)]">
          {deposits.map((d) => (
            <div key={d.id} className="p-4 transition-colors hover:bg-[var(--surface-2)]/50">
              {/* Header: User & Status */}
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-xs font-bold text-[var(--fg)] truncate">
                  {d.user.email}
                </div>
                <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-[11px] font-semibold">
                  {d.status}
                </span>
              </div>

              {/* Grid: Amount & Method */}
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-[var(--surface-2)]/40 p-2.5 border border-[var(--border)]">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Amount</span>
                  <div className="font-mono font-bold text-sm text-[var(--fg)]">
                    ${(Number(d.amountMinor) / 100).toFixed(2)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Method</span>
                  <div className="text-xs font-medium text-[var(--fg)] mt-0.5">{d.method}</div>
                </div>
              </div>

              {/* Proof / Transaction */}
              {(d.proofImageUrl || d.txHash) && (
                <div className="mt-2.5 flex items-center justify-between text-xs">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Proof</span>
                  {d.proofImageUrl ? (
                    <a
                      href={d.proofImageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold text-[var(--accent)] hover:underline"
                    >
                      <img
                        src={d.proofImageUrl}
                        alt="Proof thumbnail"
                        className="h-7 w-7 rounded-lg object-cover border border-[var(--border)] shadow-xs"
                      />
                      <span>View Receipt ↗</span>
                    </a>
                  ) : d.txHash ? (
                    <a
                      href={
                        d.method === "USDT_BEP20"
                          ? `https://bscscan.com/tx/${d.txHash}`
                          : `https://tronscan.org/#/transaction/${d.txHash}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <span>{d.txHash.slice(0, 8)}…{d.txHash.slice(-4)}</span>
                      <span>↗</span>
                    </a>
                  ) : null}
                </div>
              )}

              {/* Actions */}
              {(d.status === "PENDING" || d.status === "CONFIRMED_ON_CHAIN") && (
                <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
                  {d.method === "USDT_BEP20" && d.txHash && (
                    <form
                      action={async (fd: FormData) => {
                        "use server";
                        await verifyDepositOnChainAction(fd);
                      }}
                      className="flex-1"
                    >
                      <input type="hidden" name="depositId" value={d.id} />
                      <button
                        title="Verify on-chain using NodeReal BSC RPC"
                        className="w-full rounded-xl bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 flex items-center justify-center gap-1 shadow-xs"
                      >
                        <span>⚡ Verify</span>
                      </button>
                    </form>
                  )}
                  <form
                    action={async (fd: FormData) => {
                      "use server";
                      await approveDepositAction(fd);
                    }}
                    className="flex-1"
                  >
                    <input type="hidden" name="depositId" value={d.id} />
                    <button className="w-full rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700">
                      Approve
                    </button>
                  </form>
                  <form
                    action={async (fd: FormData) => {
                      "use server";
                      await rejectDepositAction(fd);
                    }}
                    className="flex-1"
                  >
                    <input type="hidden" name="depositId" value={d.id} />
                    <button className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] py-2 text-xs font-semibold hover:bg-[var(--surface)]">
                      Reject
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}
          {deposits.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-[var(--fg-muted)]">
              No deposits in this filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
