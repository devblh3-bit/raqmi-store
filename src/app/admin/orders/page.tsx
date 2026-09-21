import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const valid = ["PENDING", "PAID", "PLACED_WITH_PROVIDER", "COMPLETED", "PARTIALLY_DELIVERED", "FAILED", "REFUNDED"] as const;
  const where =
    status && (valid as readonly string[]).includes(status)
      ? { status: status as never }
      : {};

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      items: {
        include: {
          offer: { select: { labelEn: true } },
          providerOrders: { select: { providerOrderId: true, status: true, attempts: true } },
          attempts: { select: { status: true, providerOfferId: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Orders</h1>

      <div className="flex flex-wrap gap-1.5">
        <Link href="/admin/orders" className={`rounded-full px-3 py-1.5 text-xs font-semibold ${!status ? "bg-[var(--fg)] text-white" : "border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"}`}>All</Link>
        {valid.map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status === s ? "bg-[var(--fg)] text-white" : "border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"}`}
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-2)] text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            <tr>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Total</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Items</th>
              <th className="px-4 py-3 text-left">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-[var(--surface-2)]/50">
                <td className="px-4 py-3 font-mono text-xs">{o.code}</td>
                <td className="px-4 py-3 font-mono text-xs truncate max-w-32">{o.userId ?? o.guestEmail ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">${(Number(o.totalMinor) / 100).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs font-semibold">{o.status}</span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {o.items.map((it) => (
                    <span key={it.id} className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs mr-1">
                      {it.offer.labelEn} ×{it.quantity} · {it.providerOrders[0]?.status ?? it.attempts[0]?.status ?? "—"}
                    </span>
                  ))}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--fg-muted)]">{o.createdAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--fg-muted)]">No orders in this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
