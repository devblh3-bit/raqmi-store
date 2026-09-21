import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { attachOfferToProduct, detachOffer, updateOfferLabels } from "../../actions";

export default async function OffersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; provider?: string }>;
}) {
  const { id } = await params;
  const { q, provider } = await searchParams;

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) notFound();

  const offers = await prisma.offer.findMany({
    where: { productId: id },
    orderBy: [{ sortOrder: "asc" }],
    include: { _count: { select: { links: true } } },
  });

  const poolWhere: Record<string, unknown> = {};
  if (q) {
    poolWhere.OR = [
      { rawName: { contains: q, mode: "insensitive" } },
      { rawNameEn: { contains: q, mode: "insensitive" } },
      { providerSku: { contains: q, mode: "insensitive" } },
    ];
  }
  if (provider) {
    const prov = await prisma.provider.findUnique({ where: { code: provider } });
    if (prov) poolWhere.providerId = prov.id;
  }

  const pool = await prisma.providerOffer.findMany({
    where: poolWhere as never,
    orderBy: [{ lastSyncedAt: "desc" }],
    take: 30,
    include: { provider: { select: { code: true, displayName: true } } },
  });

  const providers = await prisma.provider.findMany({ select: { code: true, displayName: true } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight">
          Offers — {product.nameEn}
        </h1>
        <Link href={`/admin/catalog/${id}`} className="text-sm font-semibold text-[var(--accent)] hover:underline">
          ← Product
        </Link>
      </div>

      {/* Current offers for this product */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Variants ({offers.length})</h2>
        {offers.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--fg-muted)]">No offers yet. Attach from the pool below.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {offers.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {o.labelEn}
                    {o.productPinned && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">pinned</span>
                    )}
                  </p>
                  <p className="font-mono text-xs text-[var(--fg-muted)]">
                    {o.id.slice(0, 8)}… · {o._count.links} link(s)
                    {o.dedupeKey ? ` · key ${o.dedupeKey}` : ""} {o.stockQty != null ? ` · stock ${o.stockQty}` : ""}
                  </p>
                  <form
                    action={async (formData: FormData) => {
                      "use server";
                      const r = await updateOfferLabels(formData);
                      if ("error" in r) throw new Error(r.error);
                    }}
                    className="mt-2 flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="offerId" value={o.id} />
                    <input name="labelEn" defaultValue={o.labelEn} placeholder="EN" className="w-28 rounded-lg border border-[var(--border)] px-2 py-1 text-xs" />
                    <input name="labelAr" defaultValue={o.labelAr} placeholder="AR" className="w-28 rounded-lg border border-[var(--border)] px-2 py-1 text-xs" />
                    <input name="labelFr" defaultValue={o.labelFr} placeholder="FR" className="w-28 rounded-lg border border-[var(--border)] px-2 py-1 text-xs" />
                    <button className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold hover:bg-[var(--border)]">Save labels</button>
                  </form>
                </div>
                <form
                  action={async (formData: FormData) => {
                    "use server";
                    const r = await detachOffer(formData);
                    if ("error" in r) throw new Error(r.error);
                  }}
                >
                  <input type="hidden" name="offerId" value={o.id} />
                  <button className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface-2)]">
                    Unpin
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Provider pool */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Provider pool</h2>
        <form className="mt-3 flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search raw name / SKU…"
            className="min-w-48 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <select
            name="provider"
            defaultValue={provider ?? ""}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <option value="">All providers</option>
            {providers.map((p) => (
              <option key={p.code} value={p.code}>
                {p.displayName} ({p.code})
              </option>
            ))}
          </select>
          <button className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]">
            Filter
          </button>
        </form>

        <ul className="mt-4 divide-y divide-[var(--border)]">
          {pool.map((po) => (
            <li key={po.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{po.rawName || po.rawNameEn || po.providerSku}</p>
                <p className="font-mono text-xs text-[var(--fg-muted)]">
                  {po.provider.displayName} · {po.providerSku} · {po.currency} {(Number(po.costMinor) / 100).toFixed(2)} · {po.availability}
                  {po.stockQuantity != null ? ` · stock ${po.stockQuantity}` : ""}
                </p>
              </div>
              {/* Offer picker: choose which offer variant to link this ProviderOffer to.
                  Reuse attachOfferToProduct with offerId <- selected offer; productId <- current product.
                  For a minimal v1, attach always targets an existing Offer; creating an Offer from a ProviderOffer
                  is deferred to a follow-up (would need Offer.create + OfferProviderLink). */}
              <span className="text-xs text-[var(--fg-muted)]">Use offer list above to pin</span>
            </li>
          ))}
          {pool.length === 0 && <li className="py-6 text-center text-sm text-[var(--fg-muted)]">No provider offers match the filter. Run sync first.</li>}
        </ul>
      </div>

      {/* Attach helper: pick an offer to pin to this product */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Pin an offer to this product</h2>
        <p className="mt-1 text-xs text-[var(--fg-muted)]">
          Select an existing offer (from any product) to move it here and mark it pinned. Dedupe key is derived automatically.
        </p>
        <form
          action={async (formData: FormData) => {
            "use server";
            const r = await attachOfferToProduct(formData);
            if ("error" in r) throw new Error(r.error);
          }}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="productId" value={id} />
          <input
            name="offerId"
            placeholder="Offer ID (copy from variants list)"
            className="min-w-64 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--accent)]"
            required
          />
          <button className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-bold text-white hover:bg-[var(--accent-hover)]">
            Pin to this product
          </button>
        </form>
      </div>
    </div>
  );
}
