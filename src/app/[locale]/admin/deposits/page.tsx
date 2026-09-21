import Link from "next/link";
import { prisma } from "@/lib/db";
import { approveDepositAction, rejectDepositAction } from "./actions";

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
                    <a href={d.proofImageUrl} target="_blank" rel="noreferrer" className="font-semibold text-[var(--accent)] hover:underline">
                      proof
                    </a>
                  ) : d.txHash ? (
                    <span className="font-mono text-xs">{d.txHash.slice(0, 12)}…</span>
                  ) : (
                    <span className="text-[var(--fg-muted)]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {(d.status === "PENDING" || d.status === "CONFIRMED_ON_CHAIN") && (
                    <span className="inline-flex gap-1.5">
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
    </div>
  );
}
