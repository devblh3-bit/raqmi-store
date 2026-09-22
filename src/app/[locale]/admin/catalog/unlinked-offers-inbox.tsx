"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  createProductFromProviderOffer,
  linkProviderOfferToExistingProduct,
} from "./actions";

export type UnlinkedProviderOffer = {
  id: string;
  providerSku: string;
  rawName: string;
  rawNameEn: string | null;
  costMinor: string; // serialized BigInt
  currency: string;
  availability: string;
  stockQuantity: number | null;
  lastSyncedAt: string;
  provider: {
    code: string;
    displayName: string;
  };
};

export type ExistingProductOption = {
  id: string;
  nameEn: string;
  slug: string;
  categoryName: string;
};

export function UnlinkedOffersInbox({
  offers: initialOffers,
  categories,
  existingProducts,
}: {
  offers: UnlinkedProviderOffer[];
  categories: { id: string; nameEn: string; slug: string }[];
  existingProducts: ExistingProductOption[];
}) {
  const router = useRouter();
  const [offers, setOffers] = useState(initialOffers);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal states
  const [createModalOffer, setCreateModalOffer] = useState<UnlinkedProviderOffer | null>(null);
  const [createProductName, setCreateProductName] = useState("");
  const [createCategoryId, setCreateCategoryId] = useState("");
  const [createMarkup, setCreateMarkup] = useState("15");

  const [linkModalOffer, setLinkModalOffer] = useState<UnlinkedProviderOffer | null>(null);
  const [linkProductId, setLinkProductId] = useState("");
  const [linkVariantLabel, setLinkVariantLabel] = useState("");
  const [linkMarkup, setLinkMarkup] = useState("15");
  const [productSearch, setProductSearch] = useState("");

  // Unique providers list
  const providers = useMemo(() => {
    const map = new Map<string, string>();
    initialOffers.forEach((o) => map.set(o.provider.code, o.provider.displayName));
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [initialOffers]);

  // Filter offers
  const filteredOffers = useMemo(() => {
    return offers.filter((o) => {
      if (selectedProvider !== "ALL" && o.provider.code !== selectedProvider) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName =
          o.rawName.toLowerCase().includes(q) ||
          (o.rawNameEn && o.rawNameEn.toLowerCase().includes(q)) ||
          o.providerSku.toLowerCase().includes(q);
        if (!matchName) return false;
      }
      return true;
    });
  }, [offers, selectedProvider, searchQuery]);

  // Open Create Modal
  const openCreateModal = (offer: UnlinkedProviderOffer) => {
    setActionError(null);
    setCreateModalOffer(offer);
    setCreateProductName(offer.rawNameEn || offer.rawName);
    setCreateCategoryId(categories[0]?.id || "");
    setCreateMarkup("15");
  };

  // Submit Create New Product
  const handleCreateProduct = () => {
    if (!createModalOffer) return;
    setActionError(null);

    startTransition(async () => {
      const markup = Number(createMarkup) || 15;
      const res = await createProductFromProviderOffer(
        createModalOffer.id,
        createCategoryId || undefined,
        markup
      );

      if ("error" in res) {
        setActionError(`Failed to create product: ${res.error}`);
        return;
      }

      setOffers((prev) => prev.filter((o) => o.id !== createModalOffer.id));
      setCreateModalOffer(null);
      setSuccessMsg(`Created product "${createProductName}" successfully!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      router.refresh();
    });
  };

  // Open Link Modal
  const openLinkModal = (offer: UnlinkedProviderOffer) => {
    setActionError(null);
    setLinkModalOffer(offer);
    setLinkVariantLabel(offer.rawNameEn || offer.rawName);
    setLinkProductId(existingProducts[0]?.id || "");
    setLinkMarkup("15");
    setProductSearch("");
  };

  // Filtered existing products for modal
  const filteredExistingProducts = useMemo(() => {
    if (!productSearch.trim()) return existingProducts.slice(0, 8);
    const q = productSearch.toLowerCase().trim();
    return existingProducts
      .filter((p) => p.nameEn.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
      .slice(0, 8);
  }, [existingProducts, productSearch]);

  // Submit Link to Existing Product
  const handleLinkProduct = () => {
    if (!linkModalOffer || !linkProductId) return;
    setActionError(null);

    startTransition(async () => {
      const markup = Number(linkMarkup) || 15;
      const res = await linkProviderOfferToExistingProduct(
        linkProductId,
        linkModalOffer.id,
        linkVariantLabel || undefined,
        markup
      );

      if ("error" in res) {
        setActionError(`Failed to link offer: ${res.error}`);
        return;
      }

      setOffers((prev) => prev.filter((o) => o.id !== linkModalOffer.id));
      setLinkModalOffer(null);
      setSuccessMsg(`Linked variant to product successfully!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Notification / Alert Bar */}
      {successMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          ✓ {successMsg}
        </div>
      )}
      {actionError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-600 dark:text-rose-400">
          ✕ {actionError}
        </div>
      )}

      {/* Intro info box */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold tracking-tight">
              Incoming Supplier Offers ({offers.length})
            </h2>
            <p className="text-xs text-[var(--fg-muted)]">
              These items were synced from your connected upstream digital providers but haven&apos;t been added to your storefront yet.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold text-[var(--fg-muted)]">
            💡 1-Click to publish or attach as variants
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--fg-muted)]">
            🔍
          </span>
          <input
            type="text"
            placeholder="Search supplier offers by name or SKU…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-4 text-sm outline-none transition focus:border-[var(--accent)]"
          />
        </div>

        {providers.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--fg-muted)]">Provider:</span>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold outline-none focus:border-[var(--accent)]"
            >
              <option value="ALL">All Providers ({offers.length})</option>
              {providers.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Offers Table */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
              <tr>
                <th className="px-4 py-3">Supplier Offer</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Wholesale Cost</th>
                <th className="px-4 py-3 text-center">Availability</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredOffers.map((o) => {
                const costMinorNum = Number(o.costMinor);
                const costFormatted = (costMinorNum / 100).toFixed(2);
                return (
                  <tr key={o.id} className="transition-colors hover:bg-[var(--surface-2)]/50">
                    {/* Offer Name & SKU */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--fg)]">
                        {o.rawNameEn || o.rawName}
                      </p>
                      <p className="font-mono text-xs text-[var(--fg-muted)] truncate max-w-[280px]">
                        SKU: {o.providerSku}
                      </p>
                    </td>

                    {/* Provider */}
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-xs font-bold text-[var(--fg-muted)]">
                        {o.provider.displayName}
                      </span>
                    </td>

                    {/* Cost */}
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-[var(--fg)]">
                        {costFormatted} {o.currency}
                      </div>
                    </td>

                    {/* Availability */}
                    <td className="px-4 py-3 text-center">
                      {o.availability === "AVAILABLE" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          🟢 Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                          🔴 {o.availability}
                        </span>
                      )}
                    </td>

                    {/* Instant Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openCreateModal(o)}
                          className="rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[var(--accent-hover)]"
                        >
                          + Create Product
                        </button>
                        <button
                          onClick={() => openLinkModal(o)}
                          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--surface-2)]"
                        >
                          🔗 Add to Existing
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredOffers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[var(--fg-muted)]">
                    <p className="text-base font-semibold">No unlinked supplier offers</p>
                    <p className="text-xs mt-1">
                      All synced provider offers have been matched to store products, or no sync runs have executed yet.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create New Product from Supplier Offer */}
      {createModalOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">1-Click Create Product</h3>
              <button
                onClick={() => setCreateModalOffer(null)}
                className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                ✕ Close
              </button>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs space-y-1">
              <p>
                <span className="text-[var(--fg-muted)]">Supplier Item:</span>{" "}
                <span className="font-semibold">{createModalOffer.rawNameEn || createModalOffer.rawName}</span>
              </p>
              <p>
                <span className="text-[var(--fg-muted)]">Provider:</span>{" "}
                <span className="font-mono">{createModalOffer.provider.displayName} ({createModalOffer.providerSku})</span>
              </p>
              <p>
                <span className="text-[var(--fg-muted)]">Supplier Cost:</span>{" "}
                <span className="font-mono font-bold">
                  {(Number(createModalOffer.costMinor) / 100).toFixed(2)} {createModalOffer.currency}
                </span>
              </p>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-[var(--fg-muted)]">Product Title (EN)</span>
                <input
                  type="text"
                  value={createProductName}
                  onChange={(e) => setCreateProductName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
                <span className="text-[11px] text-[var(--fg-muted)] mt-0.5 block">
                  ✨ Arabic & French translations will be auto-generated automatically.
                </span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--fg-muted)]">Category</span>
                  <select
                    value={createCategoryId}
                    onChange={(e) => setCreateCategoryId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameEn}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-[var(--fg-muted)]">Profit Margin (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    value={createMarkup}
                    onChange={(e) => setCreateMarkup(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </label>
              </div>

              <div className="rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
                💡 Automatically creates product, assigns first variant, links supplier SKU, and enables live order fulfillment.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setCreateModalOffer(null)}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateProduct}
                disabled={!createProductName || isPending}
                className="rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {isPending ? "Creating…" : "Publish New Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add to Existing Product */}
      {linkModalOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Add as Variant to Existing Product</h3>
              <button
                onClick={() => setLinkModalOffer(null)}
                className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-3">
              {/* Product search */}
              <div>
                <span className="text-xs font-semibold text-[var(--fg-muted)]">Select Store Product</span>
                <input
                  type="text"
                  placeholder="Search existing products (e.g. Free Fire, Netflix)…"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
                />

                <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
                  {filteredExistingProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setLinkProductId(p.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition ${
                        linkProductId === p.id
                          ? "bg-[var(--accent)]/10 font-bold text-[var(--accent)]"
                          : "hover:bg-[var(--surface-2)]"
                      }`}
                    >
                      <span>{p.nameEn}</span>
                      <span className="text-[10px] text-[var(--fg-muted)]">{p.categoryName}</span>
                    </button>
                  ))}
                  {filteredExistingProducts.length === 0 && (
                    <p className="p-3 text-center text-xs text-[var(--fg-muted)]">
                      No matching products found.
                    </p>
                  )}
                </div>
              </div>

              {/* Variant label & markup */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--fg-muted)]">Variant Label</span>
                  <input
                    type="text"
                    value={linkVariantLabel}
                    onChange={(e) => setLinkVariantLabel(e.target.value)}
                    placeholder="e.g. 100 Diamonds / 1 Month"
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-[var(--fg-muted)]">Profit Margin (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    value={linkMarkup}
                    onChange={(e) => setLinkMarkup(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setLinkModalOffer(null)}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLinkProduct}
                disabled={!linkProductId || isPending}
                className="rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {isPending ? "Attaching…" : "Attach as Variant"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
