"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { ProductArt } from "@/lib/product-images";
import {
  toggleProductActive,
  toggleProductFeatured,
  bulkUpdateProductStatus,
  bulkUpdateProductCategory,
  bulkDeleteProducts,
} from "./actions";

export type CatalogProduct = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  nameFr: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  category: {
    id: string;
    slug: string;
    nameEn: string;
  };
  offerCount: number;
  health: "HEALTHY" | "PARTIAL" | "OUT_OF_STOCK" | "MANUAL" | "EMPTY";
  priceSummary: string;
};

export type CategoryOption = {
  id: string;
  slug: string;
  nameEn: string;
};

export function CatalogTable({
  products: initialProducts,
  categories,
  locale,
}: {
  products: CatalogProduct[];
  categories: CategoryOption[];
  locale: string;
}) {
  const [overrides, setOverrides] = useState<Record<string, Partial<CatalogProduct>>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE" | "FEATURED">("ALL");
  const [isPending, startTransition] = useTransition();
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [bulkTargetCategoryId, setBulkTargetCategoryId] = useState("");

  const products = useMemo(() => {
    return initialProducts
      .filter((p) => !deletedIds.has(p.id))
      .map((p) => (overrides[p.id] ? { ...p, ...overrides[p.id] } : p));
  }, [initialProducts, overrides, deletedIds]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter
      if (selectedCategory !== "ALL" && p.category.id !== selectedCategory) {
        return false;
      }
      // Status filter
      if (statusFilter === "ACTIVE" && !p.isActive) return false;
      if (statusFilter === "INACTIVE" && p.isActive) return false;
      if (statusFilter === "FEATURED" && !p.isFeatured) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.nameEn.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
        const matchCat = p.category.nameEn.toLowerCase().includes(q);
        if (!matchName && !matchCat) return false;
      }
      return true;
    });
  }, [products, selectedCategory, statusFilter, searchQuery]);

  // Selection handlers
  const allVisibleSelected =
    filteredProducts.length > 0 && filteredProducts.every((p) => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Optimistic 1-click toggles
  const handleToggleActive = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const current = products.find((p) => p.id === productId);
    if (!current) return;
    const nextActive = !current.isActive;
    setOverrides((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], isActive: nextActive },
    }));

    startTransition(async () => {
      const res = await toggleProductActive(productId);
      if ("error" in res) {
        setOverrides((prev) => ({
          ...prev,
          [productId]: { ...prev[productId], isActive: !nextActive },
        }));
      }
    });
  };

  const handleToggleFeatured = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const current = products.find((p) => p.id === productId);
    if (!current) return;
    const nextFeatured = !current.isFeatured;
    setOverrides((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], isFeatured: nextFeatured },
    }));

    startTransition(async () => {
      const res = await toggleProductFeatured(productId);
      if ("error" in res) {
        setOverrides((prev) => ({
          ...prev,
          [productId]: { ...prev[productId], isFeatured: !nextFeatured },
        }));
      }
    });
  };

  // Bulk actions
  const handleBulkStatus = (isActive: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setOverrides((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = { ...next[id], isActive };
      });
      return next;
    });

    startTransition(async () => {
      await bulkUpdateProductStatus(ids, isActive);
      setSelectedIds(new Set());
    });
  };

  const handleBulkCategory = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || !bulkTargetCategoryId) return;

    const targetCat = categories.find((c) => c.id === bulkTargetCategoryId);
    if (!targetCat) return;

    setOverrides((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = {
          ...next[id],
          category: { id: targetCat.id, slug: targetCat.slug, nameEn: targetCat.nameEn },
        };
      });
      return next;
    });

    startTransition(async () => {
      await bulkUpdateProductCategory(ids, bulkTargetCategoryId);
      setSelectedIds(new Set());
      setBulkCategoryOpen(false);
    });
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${ids.length} product(s)? This will also remove their variants.`)) {
      return;
    }

    setDeletedIds((prev) => new Set([...prev, ...ids]));

    startTransition(async () => {
      await bulkDeleteProducts(ids);
      setSelectedIds(new Set());
    });
  };

  return (
    <div className="space-y-4">
      {/* Search & Category Filter Chips */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--fg-muted)]">
              🔍
            </span>
            <input
              type="text"
              placeholder="Filter by product name, slug, or category…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-4 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-3 flex items-center text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 overflow-x-auto rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 text-xs font-semibold">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`rounded-full px-3 py-1 transition ${
                statusFilter === "ALL" ? "bg-[var(--accent)] text-white" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
              }`}
            >
              All ({products.length})
            </button>
            <button
              onClick={() => setStatusFilter("ACTIVE")}
              className={`rounded-full px-3 py-1 transition ${
                statusFilter === "ACTIVE" ? "bg-emerald-600 text-white" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
              }`}
            >
              Active ({products.filter((p) => p.isActive).length})
            </button>
            <button
              onClick={() => setStatusFilter("INACTIVE")}
              className={`rounded-full px-3 py-1 transition ${
                statusFilter === "INACTIVE" ? "bg-zinc-600 text-white" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
              }`}
            >
              Paused ({products.filter((p) => !p.isActive).length})
            </button>
            <button
              onClick={() => setStatusFilter("FEATURED")}
              className={`rounded-full px-3 py-1 transition ${
                statusFilter === "FEATURED" ? "bg-amber-600 text-white" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
              }`}
            >
              ⭐ Featured ({products.filter((p) => p.isFeatured).length})
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              selectedCategory === "ALL"
                ? "bg-[var(--accent)] text-white shadow-xs"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => {
            const count = products.filter((p) => p.category.id === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  selectedCategory === cat.id
                    ? "bg-[var(--accent)] text-white shadow-xs"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {cat.nameEn} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
              <tr>
                <th className="w-10 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                    className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                  />
                </th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Variants & Pricing</th>
                <th className="px-4 py-3 text-center">Supplier Stock</th>
                <th className="px-4 py-3 text-center">Featured</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredProducts.map((p) => {
                const isSelected = selectedIds.has(p.id);
                return (
                  <tr
                    key={p.id}
                    className={`transition-colors hover:bg-[var(--surface-2)]/60 ${
                      isSelected ? "bg-[var(--accent)]/5" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(p.id)}
                        aria-label={`Select ${p.nameEn}`}
                        className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                      />
                    </td>

                    {/* Product Art + Name + Slug */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ProductArt id={p.slug} size={42} />
                        <div className="min-w-0">
                          <Link
                            href={`/${locale}/admin/catalog/${p.id}`}
                            className="font-semibold text-[var(--fg)] hover:text-[var(--accent)] hover:underline"
                          >
                            {p.nameEn}
                          </Link>
                          <p className="font-mono text-xs text-[var(--fg-muted)] truncate max-w-[200px]">
                            {p.slug}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-xs font-medium text-[var(--fg-muted)]">
                        {p.category.nameEn}
                      </span>
                    </td>

                    {/* Variants & Pricing */}
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[var(--fg)]">
                            {p.priceSummary}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--fg-muted)]">
                          {p.offerCount} {p.offerCount === 1 ? "variant" : "variants"}
                        </p>
                      </div>
                    </td>

                    {/* Supplier Stock Badge */}
                    <td className="px-4 py-3 text-center">
                      {p.health === "HEALTHY" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          🟢 In Stock
                        </span>
                      )}
                      {p.health === "PARTIAL" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          🟡 Partial Stock
                        </span>
                      )}
                      {p.health === "OUT_OF_STOCK" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                          🔴 Stockout
                        </span>
                      )}
                      {p.health === "MANUAL" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
                          ⚪ Direct / Keys
                        </span>
                      )}
                      {p.health === "EMPTY" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-xs font-semibold text-zinc-500">
                          ⚠️ Needs Variants
                        </span>
                      )}
                    </td>

                    {/* Featured Star 0-Click */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => handleToggleFeatured(p.id, e)}
                        title={p.isFeatured ? "Click to unfeature" : "Click to feature on homepage"}
                        className={`text-base transition hover:scale-125 ${
                          p.isFeatured ? "text-amber-500 drop-shadow-xs" : "text-zinc-300 dark:text-zinc-700 hover:text-amber-400"
                        }`}
                      >
                        {p.isFeatured ? "★" : "☆"}
                      </button>
                    </td>

                    {/* Active Toggle Switch 0-Click */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => handleToggleActive(p.id, e)}
                        title={p.isActive ? "Click to pause product" : "Click to activate product"}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          p.isActive ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            p.isActive ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </td>

                    {/* Action Links */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/${locale}/admin/catalog/${p.id}`}
                          className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-semibold hover:bg-[var(--surface-2)]"
                        >
                          Studio ⚙️
                        </Link>
                        <Link
                          href={`/${locale}/products/${p.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          title="View on storefront"
                          className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
                        >
                          Store ↗
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[var(--fg-muted)]">
                    <p className="text-base font-semibold">No products found</p>
                    <p className="text-xs mt-1">Try adjusting your search query or category filter</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Bulk Actions Toolbar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-3 shadow-2xl backdrop-blur-md">
          <span className="text-xs font-bold text-[var(--fg)]">
            {selectedIds.size} {selectedIds.size === 1 ? "product" : "products"} selected
          </span>
          <div className="h-4 w-px bg-[var(--border)]" />
          <button
            onClick={() => handleBulkStatus(true)}
            disabled={isPending}
            className="rounded-full bg-emerald-600 px-3.5 py-1 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            Activate All
          </button>
          <button
            onClick={() => handleBulkStatus(false)}
            disabled={isPending}
            className="rounded-full bg-zinc-600 px-3.5 py-1 text-xs font-bold text-white transition hover:bg-zinc-700 disabled:opacity-50"
          >
            Pause All
          </button>
          <button
            onClick={() => setBulkCategoryOpen(true)}
            disabled={isPending}
            className="rounded-full border border-[var(--border)] px-3.5 py-1 text-xs font-bold transition hover:bg-[var(--surface-2)] disabled:opacity-50"
          >
            Change Category
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={isPending}
            className="rounded-full bg-rose-600 px-3.5 py-1 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            Delete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] ml-2"
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* Bulk Category Modal */}
      {bulkCategoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
            <h3 className="text-base font-bold">Move {selectedIds.size} products to category</h3>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              Select the new destination category for the chosen products.
            </p>
            <div className="mt-4 space-y-3">
              <select
                value={bulkTargetCategoryId}
                onChange={(e) => setBulkTargetCategoryId(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              >
                <option value="">Choose Category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameEn}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBulkCategoryOpen(false)}
                  className="rounded-full border border-[var(--border)] px-4 py-1.5 text-xs font-semibold hover:bg-[var(--surface-2)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkCategory}
                  disabled={!bulkTargetCategoryId || isPending}
                  className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-bold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                >
                  Move Products
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
