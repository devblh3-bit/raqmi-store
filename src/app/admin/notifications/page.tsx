import Link from "next/link";
import { prisma } from "@/lib/db";
import { markNotificationRead, markAllNotificationsRead } from "./actions";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ unread?: string; type?: string }>;
}) {
  const { unread, type } = await searchParams;
  const where: Record<string, unknown> = {};
  if (unread === "1") where.isRead = false;
  if (type) where.type = type;

  const [notifications, types] = await Promise.all([
    prisma.notification.findMany({
      where: where as never,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notification.findMany({ select: { type: true }, distinct: ["type"] }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <form
          action={async () => {
            "use server";
            await markAllNotificationsRead();
          }}
        >
          <button className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-xs font-semibold hover:bg-[var(--surface-2)]">
            Mark all read
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Link href="/admin/notifications" className={`rounded-full px-3 py-1.5 text-xs font-semibold ${!unread && !type ? "bg-[var(--fg)] text-white" : "border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"}`}>All</Link>
        <Link href="/admin/notifications?unread=1" className={`rounded-full px-3 py-1.5 text-xs font-semibold ${unread === "1" ? "bg-[var(--fg)] text-white" : "border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"}`}>Unread</Link>
        {types.map((t) => (
          <Link
            key={t.type}
            href={`/admin/notifications?type=${t.type}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${type === t.type ? "bg-[var(--fg)] text-white" : "border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"}`}
          >
            {t.type}
          </Link>
        ))}
      </div>

      <ul className="space-y-2">
        {notifications.map((n) => (
          <li
            key={n.id}
            className={`rounded-2xl border p-4 shadow-sm ${n.isRead ? "border-[var(--border)] bg-[var(--surface)] opacity-70" : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${n.severity === "critical" ? "bg-red-100 text-red-700" : n.severity === "warning" ? "bg-amber-100 text-amber-800" : "bg-zinc-100 text-zinc-600"}`}>
                    {n.severity}
                  </span>
                  {n.titleEn}
                </p>
                {n.bodyEn && <p className="mt-1 text-sm text-[var(--fg-muted)]">{n.bodyEn}</p>}
                <p className="mt-1 flex items-center gap-2 text-xs text-[var(--fg-muted)]">
                  <span>{n.type}</span> · <span>{n.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span>
                  {n.link && (
                    <a href={n.link} className="font-semibold text-[var(--accent)] hover:underline">
                      → {n.link}
                    </a>
                  )}
                </p>
              </div>
              {!n.isRead && (
                <form
                  action={async (fd: FormData) => {
                    "use server";
                    await markNotificationRead(fd);
                  }}
                >
                  <input type="hidden" name="id" value={n.id} />
                  <button className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold hover:bg-[var(--surface-2)]">Mark read</button>
                </form>
              )}
            </div>
          </li>
        ))}
        {notifications.length === 0 && <li className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--fg-muted)]">No notifications.</li>}
      </ul>
    </div>
  );
}
