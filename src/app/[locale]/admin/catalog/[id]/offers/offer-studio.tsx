"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  createOfferFromProvider,
  attachBackupProvider,
  updateOfferFull,
  toggleLink,
  deleteLink,
  reorderLink,
  deleteOffer,
  reorderOffer,
} from "../../actions";
import { autoTranslateStoreText, cleanProviderDescription } from "@/lib/catalog/translation";
import { formatProviderCostDisplay } from "@/lib/money";

export type SerializedProviderOffer = {
  id: string;
  providerSku: string;
  rawName: string;
  rawNameEn: string | null;
  costMinor: string; // serialized bigint
  currency: string;
  availability: string;
  stockQuantity: number | null;
  customerInputType: string | null;
  customerPrompt: string | null;
  rawWarranty: string | null;
  rawDescription: string | null;
  lastSyncedAt: string;
  provider: {
    code: string;
    displayName: string;
    isActive?: boolean;
  };
};

export type SerializedOfferLink = {
  id: string;
  priority: number;
  isEnabled: boolean;
  providerOffer: SerializedProviderOffer;
};

export type SerializedOffer = {
  id: string;
  labelEn: string;
  labelAr: string;
  labelFr: string;
  rulesEn: string;
  rulesAr: string;
  rulesFr: string;
  markupPercent: number;
  compareAtMinor: string | null;
  badge: string | null;
  productPinned: boolean;
  stockQty: number | null;
  isActive: boolean;
  links: SerializedOfferLink[];
};

export type OfferStudioProps = {
  productId: string;
  productNameEn: string;
  productSlug: string;
  locale: string;
  offers: SerializedOffer[];
  pool: SerializedProviderOffer[];
  providers: { code: string; displayName: string }[];
  initialQuery?: string;
  initialProvider?: string;
};

export function OfferStudio({
  productId,
  productNameEn,
  productSlug,
  locale,
  offers,
  pool,
  providers,
  initialQuery = "",
  initialProvider = "",
}: OfferStudioProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [creatingFromPO, setCreatingFromPO] = useState<SerializedProviderOffer | null>(null);
  const [attachingBackupPO, setAttachingBackupPO] = useState<SerializedProviderOffer | null>(null);
  const [editingOffer, setEditingOffer] = useState<SerializedOffer | null>(null);

  // Filters for provider pool
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedProvider, setSelectedProvider] = useState(initialProvider);

  const filteredPool = pool.filter((po) => {
    const matchesProvider = !selectedProvider || po.provider.code === selectedProvider;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return matchesProvider;
    const matchesQuery =
      po.rawName.toLowerCase().includes(q) ||
      (po.rawNameEn && po.rawNameEn.toLowerCase().includes(q)) ||
      po.providerSku.toLowerCase().includes(q);
    return matchesProvider && matchesQuery;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
            <Link href={`/${locale}/admin/catalog`} className="hover:underline">
              Catalog
            </Link>
            <span>/</span>
            <Link href={`/${locale}/admin/catalog/${productId}`} className="hover:underline">
              {productNameEn}
            </Link>
            <span>/</span>
            <span>Variants & Curation</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Variants & Curation — {productNameEn}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/products/${productSlug}`}
            target="_blank"
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-xs font-semibold text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
          >
            ↗ View on Storefront
          </Link>
          <Link
            href={`/${locale}/admin/catalog/${productId}`}
            className="rounded-full bg-[var(--surface-2)] px-4 py-1.5 text-xs font-semibold hover:bg-[var(--border)]"
          >
            Edit Product Details
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 font-bold hover:underline"
          >
            ✕ Dismiss
          </button>
        </div>
      )}

      {/* SECTION 1: Active Storefront Variants */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">Storefront Variants ({offers.length})</h2>
            <p className="text-xs text-[var(--fg-muted)]">
              These are the variant pills displayed on the customer product page. Each variant has its own localized rules, markup, and supplier fallback chain.
            </p>
          </div>
        </div>

        {offers.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
            <p className="text-sm font-medium text-[var(--fg-muted)]">
              No variants created for this product yet.
            </p>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              Browse the Provider Pool below and click <strong>&quot;Create Variant&quot;</strong> to add your first option.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {offers.map((offer, offerIdx) => {
              const primaryLink = offer.links.find((l) => l.priority === 1) ?? offer.links[0];
              const costDisplay = primaryLink
                ? formatProviderCostDisplay(primaryLink.providerOffer.costMinor, primaryLink.providerOffer.currency)
                : null;
              const costFloat = costDisplay ? costDisplay.usdFloat : 0;
              const retailFloat = costFloat * (1 + offer.markupPercent / 100);
              const dzdEst = Math.round(retailFloat * 240);

              return (
                <div
                  key={offer.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/30 p-4 transition hover:border-[var(--border-strong)]"
                >
                  {/* Top Bar: Title, Badges, Pricing */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Variant Reorder buttons */}
                        <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-xs">
                          <button
                            disabled={isPending || offerIdx === 0}
                            onClick={() => {
                              startTransition(async () => {
                                const fd = new FormData();
                                fd.append("offerId", offer.id);
                                fd.append("direction", "up");
                                await reorderOffer(fd);
                              });
                            }}
                            title="Move Variant Up"
                            className="px-1 hover:text-[var(--accent)] disabled:opacity-25"
                          >
                            ▲
                          </button>
                          <span className="text-[10px] text-[var(--fg-muted)]">#{offerIdx + 1}</span>
                          <button
                            disabled={isPending || offerIdx === offers.length - 1}
                            onClick={() => {
                              startTransition(async () => {
                                const fd = new FormData();
                                fd.append("offerId", offer.id);
                                fd.append("direction", "down");
                                await reorderOffer(fd);
                              });
                            }}
                            title="Move Variant Down"
                            className="px-1 hover:text-[var(--accent)] disabled:opacity-25"
                          >
                            ▼
                          </button>
                        </div>

                        <span className="text-base font-bold text-[var(--fg)]">
                          {offer.labelEn}
                        </span>
                        {offer.badge && (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            {offer.badge}
                          </span>
                        )}
                        {offer.productPinned && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Pinned
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            offer.isActive
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {offer.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>

                      {/* Multilingual Labels Subtitle */}
                      <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
                        <span className="font-medium">AR:</span> {offer.labelAr || "—"} ·{" "}
                        <span className="font-medium">FR:</span> {offer.labelFr || "—"}
                      </p>
                    </div>

                    {/* Price & Margins Display */}
                    <div className="text-right">
                      <div className="font-mono text-base font-bold text-[var(--fg)]">
                        ${retailFloat.toFixed(2)} USD{" "}
                        <span className="text-xs font-normal text-[var(--fg-muted)]">
                          (≈ {dzdEst.toLocaleString()} DZD)
                        </span>
                      </div>
                      <p className="font-mono text-xs text-[var(--fg-muted)]">
                        Wholesale: {costDisplay ? (
                          <>
                            <span className="font-bold text-[var(--fg)]">{costDisplay.primary}</span>
                            {costDisplay.secondary && <span className="ml-1 text-[var(--fg-muted)]">({costDisplay.secondary})</span>}
                          </>
                        ) : "$0.00"} · Markup: +{offer.markupPercent}%
                      </p>
                    </div>
                  </div>

                  {/* Localized Rules & Warranty Preview */}
                  {(offer.rulesEn || offer.rulesAr || offer.rulesFr) && (
                    <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-xs">
                      <p className="font-semibold text-[var(--fg-muted)]">
                        Customer Rules & Warranty:
                      </p>
                      <div className="mt-1 grid gap-2 sm:grid-cols-3">
                        <div>
                          <span className="font-semibold text-[var(--fg-muted)]">[EN]:</span>{" "}
                          <span className="text-[var(--fg)]">{offer.rulesEn || "—"}</span>
                        </div>
                        <div dir="rtl">
                          <span className="font-semibold text-[var(--fg-muted)]">[AR]:</span>{" "}
                          <span className="text-[var(--fg)]">{offer.rulesAr || "—"}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-[var(--fg-muted)]">[FR]:</span>{" "}
                          <span className="text-[var(--fg)]">{offer.rulesFr || "—"}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Fallback Supplier Links */}
                  <div className="mt-4 border-t border-[var(--border)] pt-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-[var(--fg-muted)]">
                      <span>Linked Suppliers & Fallback Order ({offer.links.length})</span>
                      <span className="text-[10px] font-normal text-[var(--fg-muted)]">
                        Priority 1 is attempted first; Priority 2 is backup if Priority 1 is OOS.
                      </span>
                    </div>

                    <div className="mt-2 space-y-1.5">
                      {offer.links.map((link, idx) => {
                        const linkDisplay = formatProviderCostDisplay(
                          link.providerOffer.costMinor,
                          link.providerOffer.currency,
                        );
                        return (
                          <div
                            key={link.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                                  link.priority === 1
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                    : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                                }`}
                              >
                                {link.priority === 1 ? "Priority 1 (Primary)" : `Priority ${link.priority} (Backup)`}
                              </span>
                              <span className="font-bold text-[var(--fg)]">
                                [{link.providerOffer.provider.displayName}]
                                {link.providerOffer.provider.isActive === false && (
                                  <span className="ml-1 rounded bg-amber-500/10 px-1 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                    Paused
                                  </span>
                                )}
                              </span>
                              <span className="font-mono text-[var(--fg-muted)]">
                                {link.providerOffer.providerSku}
                              </span>
                              <span className="text-[var(--fg-muted)]">
                                · Cost: <span className="font-semibold text-[var(--fg)]">{linkDisplay.primary}</span>
                                {linkDisplay.secondary && <span className="ml-1 text-[var(--fg-muted)]">({linkDisplay.secondary})</span>}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  link.providerOffer.availability === "AVAILABLE"
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                    : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                }`}
                              >
                                {link.providerOffer.availability}
                              </span>
                            </div>

                            {/* Link Controls: Reorder, Toggle, Remove */}
                            <div className="flex items-center gap-1.5">
                              <button
                                disabled={isPending || idx === 0}
                                onClick={() => {
                                  startTransition(async () => {
                                    const fd = new FormData();
                                    fd.append("linkId", link.id);
                                    fd.append("direction", "up");
                                    await reorderLink(fd);
                                  });
                                }}
                                title="Move Priority Up"
                                className="rounded px-1.5 py-0.5 hover:bg-[var(--surface-2)] disabled:opacity-30"
                              >
                                ▲
                              </button>
                              <button
                                disabled={isPending || idx === offer.links.length - 1}
                                onClick={() => {
                                  startTransition(async () => {
                                    const fd = new FormData();
                                    fd.append("linkId", link.id);
                                    fd.append("direction", "down");
                                    await reorderLink(fd);
                                  });
                                }}
                                title="Move Priority Down"
                                className="rounded px-1.5 py-0.5 hover:bg-[var(--surface-2)] disabled:opacity-30"
                              >
                                ▼
                              </button>

                              <button
                                disabled={isPending}
                                onClick={() => {
                                  startTransition(async () => {
                                    const fd = new FormData();
                                    fd.append("linkId", link.id);
                                    fd.append("isEnabled", String(!link.isEnabled));
                                    await toggleLink(fd);
                                  });
                                }}
                                className={`rounded-full px-2 py-0.5 font-medium ${
                                  link.isEnabled
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                                }`}
                              >
                                {link.isEnabled ? "Enabled" : "Disabled"}
                              </button>

                              {offer.links.length > 1 && (
                                <button
                                  disabled={isPending}
                                  onClick={() => {
                                    if (confirm("Remove this supplier link?")) {
                                      startTransition(async () => {
                                        const fd = new FormData();
                                        fd.append("linkId", link.id);
                                        await deleteLink(fd);
                                      });
                                    }
                                  }}
                                  className="text-rose-600 hover:underline"
                                >
                                  Disconnect
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingOffer(offer)}
                        className="rounded-full bg-[var(--surface)] px-3 py-1.5 font-semibold text-[var(--accent)] hover:bg-[var(--border)]"
                      >
                        ✏️ Edit Labels, Rules & Markup
                      </button>
                    </div>

                    <button
                      disabled={isPending}
                      onClick={() => {
                        if (
                          confirm(
                            `Delete variant "${offer.labelEn}"? This removes it from the storefront.`
                          )
                        ) {
                          startTransition(async () => {
                            const fd = new FormData();
                            fd.append("offerId", offer.id);
                            const res = await deleteOffer(fd);
                            if (res && "error" in res) {
                              alert(`Notice: ${res.error}`);
                            } else if (res && "archived" in res && res.archived) {
                              alert(res.message);
                            }
                          });
                        }
                      }}
                      className="text-rose-600 hover:underline"
                    >
                      Delete Variant
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: Synced Provider Pool */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Synced Provider Pool ({filteredPool.length})</h2>
            <p className="text-xs text-[var(--fg-muted)]">
              Raw SKUs fetched from suppliers (QCST, VBR, Canboso). Click <strong>&quot;+ Create Variant&quot;</strong> to turn any SKU into a customer offer.
            </p>
          </div>
          <Link
            href={`/${locale}/admin/sync`}
            className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--border)]"
          >
            🔄 Sync Settings
          </Link>
        </div>

        {/* Filter Controls */}
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search raw name or SKU..."
            className="min-w-64 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm outline-none focus:border-[var(--accent)]"
          >
            <option value="">All Providers</option>
            {providers.map((p) => (
              <option key={p.code} value={p.code}>
                {p.displayName} ({p.code})
              </option>
            ))}
          </select>
        </div>

        {/* Pool Table */}
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-2)] text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              <tr>
                <th className="px-4 py-3">Supplier & SKU</th>
                <th className="px-4 py-3">Wholesale Cost</th>
                <th className="px-4 py-3">Stock & Status</th>
                <th className="px-4 py-3">Specs / Warranty Notes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredPool.map((po) => {
                const costDisplay = formatProviderCostDisplay(po.costMinor, po.currency);
                return (
                  <tr key={po.id} className="hover:bg-[var(--surface-2)]/40">
                    <td className="px-4 py-3">
                      <span className="font-bold text-[var(--fg)]">
                        [{po.provider.displayName}]
                      </span>{" "}
                      <span className="font-medium text-[var(--fg)]">
                        {po.rawName || po.rawNameEn || po.providerSku}
                      </span>
                      <p className="font-mono text-[10px] text-[var(--fg-muted)]">
                        SKU: {po.providerSku}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <div className="font-bold text-[var(--fg)]">{costDisplay.primary}</div>
                      {costDisplay.secondary && (
                        <div className="text-[11px] font-normal text-[var(--fg-muted)]">
                          {costDisplay.secondary}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          po.availability === "AVAILABLE"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        }`}
                      >
                        {po.availability}
                      </span>
                      {po.stockQuantity != null && (
                        <span className="ml-1 text-[var(--fg-muted)]">
                          ({po.stockQuantity} left)
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-[var(--fg-muted)]">
                      {po.rawWarranty && (
                        <span className="mr-1 rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-medium text-[var(--fg)]">
                          {po.rawWarranty}
                        </span>
                      )}
                      {po.customerInputType && (
                        <span className="mr-1 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px]">
                          Requires: {po.customerInputType}
                        </span>
                      )}
                      <p className="line-clamp-2 text-[10px]">
                        {po.rawDescription || "No supplier description."}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setCreatingFromPO(po)}
                          className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-bold text-white shadow-sm hover:bg-[var(--accent-hover)]"
                        >
                          + Create Variant
                        </button>

                        {offers.length > 0 && (
                          <button
                            onClick={() => setAttachingBackupPO(po)}
                            title="Attach this supplier as a backup fallback to an existing variant"
                            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                          >
                            + Add as Backup
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredPool.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--fg-muted)]">
                    No supplier offers match your filter. Try adjusting your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Create New Variant from Provider SKU */}
      {creatingFromPO && (
        <CreateVariantModal
          providerOffer={creatingFromPO}
          productId={productId}
          onClose={() => setCreatingFromPO(null)}
          onError={(msg) => setError(msg)}
        />
      )}

      {/* MODAL 2: Attach as Backup Provider */}
      {attachingBackupPO && (
        <AttachBackupModal
          providerOffer={attachingBackupPO}
          offers={offers}
          onClose={() => setAttachingBackupPO(null)}
          onError={(msg) => setError(msg)}
        />
      )}

      {/* MODAL 3: Edit Existing Variant */}
      {editingOffer && (
        <EditOfferModal
          offer={editingOffer}
          onClose={() => setEditingOffer(null)}
          onError={(msg) => setError(msg)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MODAL 1: CREATE VARIANT FORM
// ---------------------------------------------------------------------------
function CreateVariantModal({
  providerOffer,
  productId,
  onClose,
  onError,
}: {
  providerOffer: SerializedProviderOffer;
  productId: string;
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const [isPending, startTransition] = useTransition();

  const costDisplay = formatProviderCostDisplay(providerOffer.costMinor, providerOffer.currency);
  const costFloat = costDisplay.usdFloat;
  const [markupPercent, setMarkupPercent] = useState<number>(25);
  const [compareAtDollars, setCompareAtDollars] = useState<string>("");
  const [badge, setBadge] = useState<string>("");

  const retailFloat = costFloat * (1 + markupPercent / 100);
  const profitFloat = retailFloat - costFloat;
  const dzdEst = Math.round(retailFloat * 240);

  const defaultTitle = providerOffer.rawNameEn || providerOffer.rawName;
  const autoTitle = autoTranslateStoreText(defaultTitle);
  const defaultRulesEn = cleanProviderDescription(
    providerOffer.rawDescription ||
    providerOffer.rawWarranty ||
    ""
  );
  const autoRules = autoTranslateStoreText(defaultRulesEn);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <h3 className="text-lg font-bold">Create Variant from Supplier SKU</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
          >
            ✕
          </button>
        </div>

        {/* Supplier Reference Box */}
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-bold text-[var(--fg)]">
                Supplier: [{providerOffer.provider.displayName}]
              </span>{" "}
              · <span className="font-mono text-[var(--fg-muted)]">SKU: {providerOffer.providerSku}</span>
            </div>
            <div className="font-mono font-bold text-[var(--fg)]">
              Wholesale Cost: {costDisplay.primary} {costDisplay.secondary && <span className="text-xs font-normal text-[var(--fg-muted)]">({costDisplay.secondary})</span>}
            </div>
          </div>
          {providerOffer.rawWarranty && (
            <p className="mt-1.5 font-medium text-emerald-700 dark:text-emerald-400">
              Warranty: {providerOffer.rawWarranty}
            </p>
          )}
          {providerOffer.rawDescription && (
            <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
              Supplier Notes: {providerOffer.rawDescription}
            </p>
          )}
        </div>

        <form
          action={(formData) => {
            startTransition(async () => {
              const res = await createOfferFromProvider(formData);
              if ("error" in res) {
                onError(`Failed to create variant: ${res.error}`);
              } else {
                onClose();
              }
            });
          }}
          className="mt-5 space-y-5"
        >
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="providerOfferId" value={providerOffer.id} />

          {/* 1. Multilingual Titles */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              1. Variant Title (Multilingual)
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <label className="text-[11px] text-[var(--fg-muted)]">English (Required)</label>
                <input
                  name="labelEn"
                  defaultValue={defaultTitle}
                  required
                  placeholder="e.g. 1 Month — Personal"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div dir="rtl">
                <label className="text-[11px] text-[var(--fg-muted)]">العربية (Required)</label>
                <input
                  name="labelAr"
                  defaultValue={autoTitle.ar || defaultTitle}
                  required
                  placeholder="مثال: شهر واحد — حساب شخصي"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--fg-muted)]">Français (Required)</label>
                <input
                  name="labelFr"
                  defaultValue={autoTitle.fr || defaultTitle}
                  required
                  placeholder="ex. 1 Mois — Personnel"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          </div>

          {/* 2. Multilingual Rules & Warranty Instructions */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              2. Customer Rules & Warranty Instructions (Displayed on Storefront)
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <label className="text-[11px] text-[var(--fg-muted)]">English Rules</label>
                <textarea
                  name="rulesEn"
                  rows={3}
                  defaultValue={defaultRulesEn}
                  placeholder="e.g. 30 days replacement warranty. Enter your OpenAI email at checkout."
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div dir="rtl">
                <label className="text-[11px] text-[var(--fg-muted)]">التعليمات والضمان بالعربية</label>
                <textarea
                  name="rulesAr"
                  rows={3}
                  defaultValue={autoRules.ar || defaultRulesEn}
                  placeholder="مثال: ضمان لمدة 30 يوم. يرجى إدخال بريدك الإلكتروني لتفعيل الاشتراك."
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--fg-muted)]">Instructions en Français</label>
                <textarea
                  name="rulesFr"
                  rows={3}
                  defaultValue={autoRules.fr || defaultRulesEn}
                  placeholder="ex. Garantie de 30 jours. Fournissez votre adresse e-mail lors de la commande."
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          </div>

          {/* 3. Pricing, Margins & Badges */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              3. Pricing, Markup & Badging
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-[11px] text-[var(--fg-muted)]">Markup Percentage (%)</label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    name="markupPercent"
                    value={markupPercent}
                    onChange={(e) => setMarkupPercent(Number(e.target.value) || 0)}
                    min={0}
                    max={1000}
                    step={0.5}
                    required
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--accent)]"
                  />
                  <span className="absolute right-3 top-2 text-xs text-[var(--fg-muted)]">%</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[var(--fg-muted)]">Feature Badge</label>
                <select
                  name="badge"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
                >
                  <option value="">No Badge</option>
                  <option value="BUDGET">BUDGET</option>
                  <option value="POPULAR">POPULAR</option>
                  <option value="BEST VALUE">BEST VALUE</option>
                  <option value="VIP">VIP</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-[var(--fg-muted)]">Compare-At Price ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 24.99 (crossed out)"
                  value={compareAtDollars}
                  onChange={(e) => setCompareAtDollars(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--accent)]"
                />
                {compareAtDollars && (
                  <input
                    type="hidden"
                    name="compareAtMinor"
                    value={Math.round(Number(compareAtDollars) * 100)}
                  />
                )}
              </div>
            </div>

            {/* Real-time Calculation Summary Box */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
                <div>
                  <span className="text-[var(--fg-muted)]">Cost:</span> ${costFloat.toFixed(2)} +{" "}
                  <span className="text-[var(--fg-muted)]">Profit ({markupPercent}%):</span> $
                  {profitFloat.toFixed(2)}
                </div>
                <div className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                  Selling Price: ${retailFloat.toFixed(2)} USD{" "}
                  <span className="text-xs font-normal text-[var(--fg-muted)]">
                    (≈ {dzdEst.toLocaleString()} DZD)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {isPending ? "Creating Variant..." : "Create Variant & Link Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MODAL 2: ATTACH BACKUP SUPPLIER
// ---------------------------------------------------------------------------
function AttachBackupModal({
  providerOffer,
  offers,
  onClose,
  onError,
}: {
  providerOffer: SerializedProviderOffer;
  offers: SerializedOffer[];
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedOfferId, setSelectedOfferId] = useState<string>(offers[0]?.id || "");
  const costDisplay = formatProviderCostDisplay(providerOffer.costMinor, providerOffer.currency);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <h3 className="text-lg font-bold">Attach as Backup Supplier</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3 text-xs">
          <p className="font-bold text-[var(--fg)]">
            Supplier: [{providerOffer.provider.displayName}] · SKU: {providerOffer.providerSku}
          </p>
          <p className="font-mono text-[var(--fg-muted)]">
            Cost: <span className="font-bold text-[var(--fg)]">{costDisplay.primary}</span>
            {costDisplay.secondary && <span className="ml-1">({costDisplay.secondary})</span>} · Status:{" "}
            {providerOffer.availability}
          </p>
          {providerOffer.rawWarranty && (
            <p className="mt-1 text-emerald-700 dark:text-emerald-400">
              Warranty: {providerOffer.rawWarranty}
            </p>
          )}
        </div>

        {/* Safety Warning */}
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          ⚠️ <strong>Identical Terms Required:</strong> Only link this supplier if its warranty,
          account type (shared vs. private), and delivery method match the chosen variant 100%. If
          the terms differ, create a separate variant instead.
        </div>

        <form
          action={(formData) => {
            startTransition(async () => {
              const res = await attachBackupProvider(formData);
              if ("error" in res) {
                onError(`Failed to attach backup provider: ${res.error}`);
              } else {
                onClose();
              }
            });
          }}
          className="mt-4 space-y-4"
        >
          <input type="hidden" name="providerOfferId" value={providerOffer.id} />

          <div>
            <label className="text-xs font-semibold text-[var(--fg)]">
              Select Target Storefront Variant:
            </label>
            <select
              name="offerId"
              value={selectedOfferId}
              onChange={(e) => setSelectedOfferId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5 text-xs outline-none focus:border-[var(--accent)]"
            >
              {offers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.labelEn} ({o.links.length} supplier{o.links.length === 1 ? "" : "s"} linked)
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !selectedOfferId}
              className="rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {isPending ? "Attaching..." : "Attach as Backup (Priority +1)"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MODAL 3: EDIT EXISTING VARIANT
// ---------------------------------------------------------------------------
function EditOfferModal({
  offer,
  onClose,
  onError,
}: {
  offer: SerializedOffer;
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const [isPending, startTransition] = useTransition();

  const primaryLink = offer.links.find((l) => l.priority === 1) ?? offer.links[0];
  const costDisplay = primaryLink
    ? formatProviderCostDisplay(primaryLink.providerOffer.costMinor, primaryLink.providerOffer.currency)
    : null;
  const costFloat = costDisplay ? costDisplay.usdFloat : 0;

  const [markupPercent, setMarkupPercent] = useState<number>(offer.markupPercent);
  const [compareAtDollars, setCompareAtDollars] = useState<string>(
    offer.compareAtMinor ? (Number(offer.compareAtMinor) / 100).toFixed(2) : ""
  );
  const [badge, setBadge] = useState<string>(offer.badge || "");

  const retailFloat = costFloat * (1 + markupPercent / 100);
  const profitFloat = retailFloat - costFloat;
  const dzdEst = Math.round(retailFloat * 240);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <h3 className="text-lg font-bold">Edit Variant — {offer.labelEn}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
          >
            ✕
          </button>
        </div>

        <form
          action={(formData) => {
            startTransition(async () => {
              const res = await updateOfferFull(formData);
              if ("error" in res) {
                onError(`Failed to update variant: ${res.error}`);
              } else {
                onClose();
              }
            });
          }}
          className="mt-4 space-y-5"
        >
          <input type="hidden" name="offerId" value={offer.id} />

          {/* 1. Labels */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              1. Variant Labels
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <label className="text-[11px] text-[var(--fg-muted)]">English</label>
                <input
                  name="labelEn"
                  defaultValue={offer.labelEn}
                  required
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div dir="rtl">
                <label className="text-[11px] text-[var(--fg-muted)]">العربية</label>
                <input
                  name="labelAr"
                  defaultValue={offer.labelAr}
                  required
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--fg-muted)]">Français</label>
                <input
                  name="labelFr"
                  defaultValue={offer.labelFr}
                  required
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          </div>

          {/* 2. Rules */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              2. Rules & Warranty Instructions
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <label className="text-[11px] text-[var(--fg-muted)]">English</label>
                <textarea
                  name="rulesEn"
                  rows={3}
                  defaultValue={offer.rulesEn}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div dir="rtl">
                <label className="text-[11px] text-[var(--fg-muted)]">العربية</label>
                <textarea
                  name="rulesAr"
                  rows={3}
                  defaultValue={offer.rulesAr}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--fg-muted)]">Français</label>
                <textarea
                  name="rulesFr"
                  rows={3}
                  defaultValue={offer.rulesFr}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          </div>

          {/* 3. Pricing */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              3. Markup & Badges
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-[11px] text-[var(--fg-muted)]">Markup Percentage (%)</label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    name="markupPercent"
                    value={markupPercent}
                    onChange={(e) => setMarkupPercent(Number(e.target.value) || 0)}
                    min={0}
                    max={1000}
                    step={0.5}
                    required
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--accent)]"
                  />
                  <span className="absolute right-3 top-2 text-xs text-[var(--fg-muted)]">%</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[var(--fg-muted)]">Feature Badge</label>
                <select
                  name="badge"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
                >
                  <option value="">No Badge</option>
                  <option value="BUDGET">BUDGET</option>
                  <option value="POPULAR">POPULAR</option>
                  <option value="BEST VALUE">BEST VALUE</option>
                  <option value="VIP">VIP</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-[var(--fg-muted)]">Compare-At Price ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 24.99"
                  value={compareAtDollars}
                  onChange={(e) => setCompareAtDollars(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--accent)]"
                />
                {compareAtDollars && (
                  <input
                    type="hidden"
                    name="compareAtMinor"
                    value={Math.round(Number(compareAtDollars) * 100)}
                  />
                )}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
                <div>
                  <span className="text-[var(--fg-muted)]">Cost:</span> ${costFloat.toFixed(2)} +{" "}
                  <span className="text-[var(--fg-muted)]">Profit ({markupPercent}%):</span> $
                  {profitFloat.toFixed(2)}
                </div>
                <div className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                  Selling Price: ${retailFloat.toFixed(2)} USD{" "}
                  <span className="text-xs font-normal text-[var(--fg-muted)]">
                    (≈ {dzdEst.toLocaleString()} DZD)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

