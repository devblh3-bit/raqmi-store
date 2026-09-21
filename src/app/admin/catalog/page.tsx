import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const where = q
    ? {
        OR: [
          { nameEn: { contains: q, mode: "insensitive" as const } },
          { slug: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      category: { select: { slug: true, nameEn: true } },
      _count: { select: { offers: true } },
    },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Catalog</h1>
        <Link
          href="/admin/catalog/new"
          className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-[var(--accent-hover)]"
        >
          New product
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or slug…"
          className="flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <button className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]">
          Search
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-2)] text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            <tr>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-center">Offers</th>
              <th className="px-4 py-3 text-center">Active</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-[var(--surface-2)]/50">
                <td className="px-4 py-3">
                  <p className="font-semibold">{p.nameEn}</p>
                  <p className="font-mono text-xs text-[var(--fg-muted)]">{p.slug}</p>
                </td>
                <td className="px-4 py-3 text-[var(--fg-muted)]">{p.category.nameEn}</td>
                <td className="px-4 py-3 text-center">{p._count.offers}</td>
                <td className="px-4 py-3 text-center">{p.isActive ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/catalog/${p.id}`} className="font-semibold text-[var(--accent)] hover:underline">
                    Edit
                  </Link>
                  {" · "}
                  <Link href={`/admin/catalog/${p.id}/offers`} className="font-semibold text-[var(--accent)] hover:underline">
                    Offers
                  </Link>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--fg-muted)]">
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
