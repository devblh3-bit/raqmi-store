import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/en/login?next=/admin");
  if (session.role !== "ADMIN") redirect("/en/login?next=/admin");

  const nav = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/catalog", label: "Catalog" },
    { href: "/admin/deposits", label: "Deposits" },
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/notifications", label: "Notifications" },
    { href: "/admin/sync", label: "Sync" },
  ] as const;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl gap-6 px-4 py-6 sm:px-6">
      <aside className="w-48 shrink-0">
        <div className="sticky top-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <p className="text-xs font-bold tracking-wide text-[var(--fg-muted)]">Admin</p>
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
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
