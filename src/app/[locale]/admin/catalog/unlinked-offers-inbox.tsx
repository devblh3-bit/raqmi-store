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
    isActive?: boolean;
  };
};

export type ExistingProductOption = {
  id: string;
  nameEn: string;
  slug: string;
  categoryName: string;
};

const KEYWORD_CATEGORIES = [
  { id: "ALL", label: "All Types" },
  { id: "AI", label: "🤖 AI & Models", keywords: ["ai", "claude", "chatgpt", "gemini", "codex", "gpt", "openai", "token", "midjourney"] },
  { id: "DESIGN", label: "🎨 Canva & Design", keywords: ["canva", "adobe", "capcut", "photoshop", "illustrator", "creative"] },
  { id: "VPN", label: "🛡️ VPN & Security", keywords: ["vpn", "adguard", "nordvpn", "ipvanish", "surfshark", "expressvpn"] },
  { id: "OFFICE", label: "💼 Office & Windows", keywords: ["office", "windows", "microsoft", "word", "excel", "license", "key", "365"] },
  { id: "STREAMING", label: "🎬 Streaming & Music", keywords: ["netflix", "spotify", "youtube", "disney", "prime", "music", "tv"] },
  { id: "ACCOUNTS", label: "📧 Accounts & Cloud", keywords: ["gmail", "account", "aws", "cloud", "google", "mail", "edu"] },
];

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
  const [stockFilter, setStockFilter] = useState<"ALL" | "IN_STOCK" | "OUT_OF_STOCK">("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"NEWEST" | "STOCK_FIRST" | "COST_ASC" | "COST_DESC" | "NAME_ASC">("NEWEST");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<"25" | "50" | "100" | "ALL">("25");

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

  // Unique providers list with counts and active status
  const providers = useMemo(() => {
    const map = new Map<string, { code: string; name: string; isActive?: boolean; count: number }>();
    offers.forEach((o) => {
      const existing = map.get(o.provider.code);
      if (existing) {
        existing.count++;
      } else {
        map.set(o.provider.code, {
          code: o.provider.code,
          name: o.provider.displayName,
          isActive: o.provider.isActive,
          count: 1,
        });
      }
    });
    return Array.from(map.values());
  }, [offers]);

  // Overall stock counts
  const inStockCount = useMemo(() => {
    return offers.filter((o) => o.availability?.toUpperCase() === "AVAILABLE").length;
  }, [offers]);

  const outOfStockCount = offers.length - inStockCount;

  // Filter & Sort offers
  const filteredAndSortedOffers = useMemo(() => {
    const result = offers.filter((o) => {
      // Provider filter
      if (selectedProvider !== "ALL" && o.provider.code !== selectedProvider) {
        return false;
      }

      // Stock status filter
      const isAvailable = o.availability?.toUpperCase() === "AVAILABLE";
      if (stockFilter === "IN_STOCK" && !isAvailable) return false;
      if (stockFilter === "OUT_OF_STOCK" && isAvailable) return false;

      // Keyword category filter
      if (selectedCategory !== "ALL") {
        const cat = KEYWORD_CATEGORIES.find((c) => c.id === selectedCategory);
        if (cat?.keywords) {
          const text = `${o.rawName} ${o.rawNameEn || ""} ${o.providerSku}`.toLowerCase();
          const matchesCategory = cat.keywords.some((kw) => text.includes(kw));
          if (!matchesCategory) return false;
        }
      }

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const text = `${o.rawName} ${o.rawNameEn || ""} ${o.providerSku}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });

    // Sort
    result.sort((a, b) => {
      const aAvail = a.availability?.toUpperCase() === "AVAILABLE" ? 1 : 0;
      const bAvail = b.availability?.toUpperCase() === "AVAILABLE" ? 1 : 0;

      if (sortBy === "STOCK_FIRST") {
        if (aAvail !== bAvail) return bAvail - aAvail;
        return new Date(b.lastSyncedAt).getTime() - new Date(a.lastSyncedAt).getTime();
      }

      const getNormalizedUsdCost = (item: UnlinkedProviderOffer) => {
        const minor = Number(item.costMinor);
        if (item.currency === "VND") return minor * 0.00004;
        if (item.currency === "DZD") return minor / 240;
        return minor;
      };

      if (sortBy === "COST_ASC") {
        return getNormalizedUsdCost(a) - getNormalizedUsdCost(b);
      }
      if (sortBy === "COST_DESC") {
        return getNormalizedUsdCost(b) - getNormalizedUsdCost(a);
      }
      if (sortBy === "NAME_ASC") {
        const nameA = a.rawNameEn || a.rawName;
        const nameB = b.rawNameEn || b.rawName;
        return nameA.localeCompare(nameB);
      }

      // Default NEWEST
      return new Date(b.lastSyncedAt).getTime() - new Date(a.lastSyncedAt).getTime();
    });

    return result;
  }, [offers, selectedProvider, stockFilter, selectedCategory, searchQuery, sortBy]);

  // Pagination
  const totalItems = filteredAndSortedOffers.length;
  const totalPages = pageSize === "ALL" ? 1 : Math.ceil(totalItems / Number(pageSize));
  const safeCurrentPage = Math.max(1, Math.min(currentPage, totalPages || 1));

  const paginatedOffers = useMemo(() => {
    if (pageSize === "ALL") return filteredAndSortedOffers;
    const size = Number(pageSize);
    const start = (safeCurrentPage - 1) * size;
    return filteredAndSortedOffers.slice(start, start + size);
  }, [filteredAndSortedOffers, safeCurrentPage, pageSize]);

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

      {/* Filters Toolbar */}
      <div className="space-y-3">
        {/* Row 1: Search bar + Sort selector + Page size */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--fg-muted)]">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search by name, SKU, or model…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-8 text-sm outline-none transition focus:border-[var(--accent)]"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
                className="absolute inset-y-0 right-3 flex items-center text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--fg-muted)] font-medium">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as typeof sortBy);
                  setCurrentPage(1);
                }}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-semibold outline-none focus:border-[var(--accent)]"
              >
                <option value="NEWEST">🕒 Newest Synced</option>
                <option value="STOCK_FIRST">🟢 In-Stock First</option>
                <option value="COST_ASC">💵 Cost: Low to High</option>
                <option value="COST_DESC">💰 Cost: High to Low</option>
                <option value="NAME_ASC">🔤 Name: A → Z</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[var(--fg-muted)] font-medium">Per Page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(e.target.value as typeof pageSize);
                  setCurrentPage(1);
                }}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-semibold outline-none focus:border-[var(--accent)]"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="ALL">All ({totalItems})</option>
              </select>
            </div>
          </div>
        </div>

        {/* Row 2: Provider & Stock Status Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Provider Pills */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 text-xs font-semibold">
            <button
              onClick={() => {
                setSelectedProvider("ALL");
                setCurrentPage(1);
              }}
              className={`rounded-full px-3 py-1 transition ${
                selectedProvider === "ALL"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
              }`}
            >
              All Providers ({offers.length})
            </button>
            {providers.map((p) => (
              <button
                key={p.code}
                onClick={() => {
                  setSelectedProvider(p.code);
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition ${
                  selectedProvider === p.code
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    p.isActive !== false ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                <span>
                  {p.name} ({p.count})
                </span>
              </button>
            ))}
          </div>

          {/* Stock Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 text-xs font-semibold">
            <button
              onClick={() => {
                setStockFilter("ALL");
                setCurrentPage(1);
              }}
              className={`rounded-full px-3 py-1 transition ${
                stockFilter === "ALL"
                  ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
              }`}
            >
              All Stock ({offers.length})
            </button>
            <button
              onClick={() => {
                setStockFilter("IN_STOCK");
                setCurrentPage(1);
              }}
              className={`rounded-full px-3 py-1 transition ${
                stockFilter === "IN_STOCK"
                  ? "bg-emerald-600 text-white"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
              }`}
            >
              🟢 In Stock ({inStockCount})
            </button>
            <button
              onClick={() => {
                setStockFilter("OUT_OF_STOCK");
                setCurrentPage(1);
              }}
              className={`rounded-full px-3 py-1 transition ${
                stockFilter === "OUT_OF_STOCK"
                  ? "bg-rose-600 text-white"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
              }`}
            >
              🔴 Out of Stock ({outOfStockCount})
            </button>
          </div>
        </div>

        {/* Row 3: Keyword / Category Quick Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {KEYWORD_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setCurrentPage(1);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                selectedCategory === cat.id
                  ? "bg-[var(--accent)] text-white shadow-xs"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
              }`}
            >
              {cat.label}
            </button>
          ))}
          {(selectedProvider !== "ALL" ||
            stockFilter !== "ALL" ||
            selectedCategory !== "ALL" ||
            searchQuery.trim()) && (
            <button
              onClick={() => {
                setSelectedProvider("ALL");
                setStockFilter("ALL");
                setSelectedCategory("ALL");
                setSearchQuery("");
                setCurrentPage(1);
              }}
              className="text-xs text-[var(--accent)] hover:underline ml-2"
            >
              Reset Filters
            </button>
          )}
        </div>
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
              {paginatedOffers.map((o) => {
                const costMinorNum = Number(o.costMinor);
                const isAvailable = o.availability?.toUpperCase() === "AVAILABLE";

                // Converted cost display
                let costFormatted = `${(costMinorNum / 100).toFixed(2)} ${o.currency}`;
                let costSubtext: string | null = null;
                if (o.currency === "VND") {
                  const usdEst = (costMinorNum * 0.00004 / 100).toFixed(2);
                  costFormatted = `${costMinorNum.toLocaleString()} VND`;
                  costSubtext = `≈ $${usdEst} USD`;
                } else if (o.currency === "DZD") {
                  const usdEst = (costMinorNum / 100 / 240).toFixed(2);
                  costFormatted = `${(costMinorNum / 100).toLocaleString()} DZD`;
                  costSubtext = `≈ $${usdEst} USD`;
                }

                return (
                  <tr key={o.id} className="transition-colors hover:bg-[var(--surface-2)]/50">
                    {/* Offer Name & SKU */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--fg)]">
                        {o.rawNameEn || o.rawName}
                      </p>
                      <p className="font-mono text-xs text-[var(--fg-muted)] truncate max-w-[320px]">
                        SKU: {o.providerSku}
                      </p>
                    </td>

                    {/* Provider */}
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-xs font-bold text-[var(--fg-muted)]">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            o.provider.isActive !== false ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        />
                        <span>{o.provider.displayName}</span>
                        {o.provider.isActive === false && (
                          <span className="text-[10px] text-amber-500 font-normal">(Paused)</span>
                        )}
                      </div>
                    </td>

                    {/* Cost */}
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-[var(--fg)]">
                        {costFormatted}
                      </div>
                      {costSubtext && (
                        <div className="font-mono text-xs text-[var(--fg-muted)]">
                          {costSubtext}
                        </div>
                      )}
                    </td>

                    {/* Availability */}
                    <td className="px-4 py-3 text-center">
                      {isAvailable ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          🟢 In Stock
                          {o.stockQuantity != null && o.stockQuantity > 0 && (
                            <span className="text-[10px] opacity-80">({o.stockQuantity})</span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                          🔴 Out of Stock
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

              {paginatedOffers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[var(--fg-muted)]">
                    <p className="text-base font-semibold">No unlinked supplier offers matching filters</p>
                    <p className="text-xs mt-1">
                      Try clearing the search query or selecting a different provider/stock filter.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalItems > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-2)]/40 px-4 py-3 text-xs text-[var(--fg-muted)]">
            <div>
              Showing{" "}
              <span className="font-semibold text-[var(--fg)]">
                {pageSize === "ALL" ? 1 : (safeCurrentPage - 1) * Number(pageSize) + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-[var(--fg)]">
                {pageSize === "ALL"
                  ? totalItems
                  : Math.min(safeCurrentPage * Number(pageSize), totalItems)}
              </span>{" "}
              of <span className="font-semibold text-[var(--fg)]">{totalItems}</span> offers
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 font-semibold hover:bg-[var(--surface-2)] disabled:opacity-30"
                >
                  ← Previous
                </button>
                <span className="px-2 font-mono font-medium">
                  {safeCurrentPage} / {totalPages}
                </span>
                <button
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 font-semibold hover:bg-[var(--surface-2)] disabled:opacity-30"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
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
