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
  health: "HEALTHY" | "PARTIAL" | "OUT_OF_STOCK" | "MANUAL" | "EMPTY" | "PROVIDER_PAUSED";
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
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE" | "FEATURED" | "PROVIDER_PAUSED">("ALL");
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
      if (statusFilter === "PROVIDER_PAUSED" && p.health !== "PROVIDER_PAUSED") return false;

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

  // Sort products: active products with active suppliers first, paused/provider-paused at the bottom
  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      const aDisabled = !a.isActive || a.health === "PROVIDER_PAUSED";
      const bDisabled = !b.isActive || b.health === "PROVIDER_PAUSED";
      if (aDisabled !== bDisabled) {
        return aDisabled ? 1 : -1;
      }
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.nameEn.localeCompare(b.nameEn);
    });
  }, [filteredProducts]);

  // Selection handlers
  const allVisibleSelected =
    sortedProducts.length > 0 && sortedProducts.every((p) => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedProducts.map((p) => p.id)));
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
      {/* Search & Category Filter Toolbar */}
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
            className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
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

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium outline-none transition focus:border-[var(--accent)]"
          >
            <option value="ALL">All Status ({products.length})</option>
            <option value="ACTIVE">Active ({products.filter((p) => p.isActive).length})</option>
            <option value="INACTIVE">Paused ({products.filter((p) => !p.isActive).length})</option>
            <option value="FEATURED">⭐ Featured ({products.filter((p) => p.isFeatured).length})</option>
            {products.some((p) => p.health === "PROVIDER_PAUSED") && (
              <option value="PROVIDER_PAUSED">⏸️ Provider Paused ({products.filter((p) => p.health === "PROVIDER_PAUSED").length})</option>
            )}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium outline-none transition focus:border-[var(--accent)]"
          >
            <option value="ALL">All Categories</option>
            {categories.map((cat) => {
              const count = products.filter((p) => p.category.id === cat.id).length;
              return (
                <option key={cat.id} value={cat.id}>
                  {cat.nameEn} ({count})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
              <tr>
                <th className="w-9 px-2.5 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                    className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                  />
                </th>
                <th className="px-3 py-2.5">Product</th>
                <th className="px-2.5 py-2.5 whitespace-nowrap">Category</th>
                <th className="px-2.5 py-2.5 whitespace-nowrap">Pricing</th>
                <th className="px-2 py-2.5 text-center whitespace-nowrap">Stock</th>
                <th className="w-10 px-1 py-2.5 text-center" title="Featured">★</th>
                <th className="w-14 px-1 py-2.5 text-center">Status</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {sortedProducts.map((p) => {
                const isSelected = selectedIds.has(p.id);
                return (
                  <tr
                    key={p.id}
                    className={`transition-colors hover:bg-[var(--surface-2)]/60 ${
                      isSelected ? "bg-[var(--accent)]/5" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-2.5 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(p.id)}
                        aria-label={`Select ${p.nameEn}`}
                        className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                      />
                    </td>

                    {/* Product Art + Name + Slug */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <ProductArt id={p.slug} size={34} />
                        <div className="min-w-0 max-w-[200px] xl:max-w-[280px]">
                          <Link
                            href={`/${locale}/admin/catalog/${p.id}`}
                            className="font-semibold text-xs text-[var(--fg)] hover:text-[var(--accent)] hover:underline truncate block"
                          >
                            {p.nameEn}
                          </Link>
                          <p className="font-mono text-[10px] text-[var(--fg-muted)] truncate">
                            {p.slug}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-2.5 py-2 whitespace-nowrap">
                      <span className="inline-flex rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--fg-muted)]">
                        {p.category.nameEn}
                      </span>
                    </td>

                    {/* Variants & Pricing */}
                    <td className="px-2.5 py-2 whitespace-nowrap">
                      <div className="font-semibold text-xs text-[var(--fg)]">
                        {p.priceSummary}
                      </div>
                      <p className="text-[10px] text-[var(--fg-muted)]">
                        {p.offerCount} {p.offerCount === 1 ? "offer" : "offers"}
                      </p>
                    </td>

                    {/* Supplier Stock Indicator */}
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <div className="inline-flex items-center justify-center gap-1 text-[11px] font-medium">
                        {p.health === "HEALTHY" && (
                          <><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" /> <span className="text-emerald-700 dark:text-emerald-400">In Stock</span></>
                        )}
                        {p.health === "PARTIAL" && (
                          <><span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" /> <span className="text-amber-700 dark:text-amber-400">Partial</span></>
                        )}
                        {p.health === "OUT_OF_STOCK" && (
                          <><span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" /> <span className="text-rose-700 dark:text-rose-400">Stockout</span></>
                        )}
                        {p.health === "PROVIDER_PAUSED" && (
                          <><span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" /> <span className="text-amber-700 dark:text-amber-400">Paused</span></>
                        )}
                        {p.health === "MANUAL" && (
                          <><span className="h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" /> <span className="text-sky-700 dark:text-sky-400">Keys</span></>
                        )}
                        {p.health === "EMPTY" && (
                          <><span className="h-1.5 w-1.5 rounded-full bg-zinc-400 shrink-0" /> <span className="text-[var(--fg-muted)]">Empty</span></>
                        )}
                      </div>
                    </td>

                    {/* Featured Star 0-Click */}
                    <td className="w-10 px-1 py-2 text-center">
                      <button
                        onClick={(e) => handleToggleFeatured(p.id, e)}
                        title={p.isFeatured ? "Click to unfeature" : "Click to feature on homepage"}
                        className={`text-sm transition hover:scale-125 ${
                          p.isFeatured ? "text-amber-500 drop-shadow-xs" : "text-zinc-300 dark:text-zinc-700 hover:text-amber-400"
                        }`}
                      >
                        {p.isFeatured ? "★" : "☆"}
                      </button>
                    </td>

                    {/* Active Toggle Switch 0-Click */}
                    <td className="w-14 px-1 py-2 text-center">
                      <button
                        onClick={(e) => handleToggleActive(p.id, e)}
                        title={p.isActive ? "Click to pause product" : "Click to activate product"}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          p.isActive ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                            p.isActive ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </td>

                    {/* Action Links */}
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/${locale}/admin/catalog/${p.id}`}
                          className="rounded-md border border-[var(--border)] px-2 py-0.5 text-xs font-semibold hover:bg-[var(--surface-2)]"
                        >
                          Studio ⚙️
                        </Link>
                        <Link
                          href={`/${locale}/products/${p.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          title="View on storefront"
                          className="rounded-md p-1 text-xs text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                        >
                          ↗
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {sortedProducts.length === 0 && (
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

        {/* Mobile View (Cards) */}
        <div className="md:hidden divide-y divide-[var(--border)]">
          {sortedProducts.map((p) => {
            const isSelected = selectedIds.has(p.id);
            return (
              <div key={p.id} className={`p-4 transition-colors hover:bg-[var(--surface-2)]/60 ${isSelected ? "bg-[var(--accent)]/5" : ""}`}>
                {/* Header: Checkbox + Identity + Star */}
                <div className="flex items-start gap-3">
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectOne(p.id)}
                      className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                    />
                  </div>
                  <div className="flex flex-1 gap-3 min-w-0">
                    <ProductArt id={p.slug} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="font-bold text-sm text-[var(--fg)] leading-tight truncate">{p.nameEn}</div>
                        <button
                          onClick={(e) => handleToggleFeatured(p.id, e)}
                          title={p.isFeatured ? "Click to unfeature" : "Click to feature"}
                          className={`text-base shrink-0 transition ${p.isFeatured ? "text-amber-500 drop-shadow-xs" : "text-zinc-300 dark:text-zinc-700 hover:text-amber-400"}`}
                        >
                          {p.isFeatured ? "★" : "☆"}
                        </button>
                      </div>
                      <div className="font-mono text-[10px] text-[var(--fg-muted)] mt-0.5 truncate">{p.slug}</div>
                    </div>
                  </div>
                </div>

                {/* Body: Stats Grid */}
                <div className="mt-3.5 grid grid-cols-2 gap-y-2.5 gap-x-4 rounded-xl bg-[var(--surface-2)]/40 p-3 border border-[var(--border)]">
                  {/* Category */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Category</p>
                    <div className="mt-0.5">
                      <span className="inline-flex rounded-full bg-[var(--surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--fg)] border border-[var(--border)]">
                        {p.category.nameEn}
                      </span>
                    </div>
                  </div>
                  {/* Pricing */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Pricing</p>
                    {p.offerCount > 0 ? (
                      <div className="mt-0.5 flex flex-col leading-tight">
                        <span className="text-sm font-bold text-[var(--fg)]">
                          {p.priceSummary}
                        </span>
                        <span className="text-[10px] text-[var(--fg-muted)]">{p.offerCount} variant{p.offerCount === 1 ? "" : "s"}</span>
                      </div>
                    ) : (
                      <div className="mt-0.5 text-xs font-semibold text-[var(--fg-muted)]">No Variants</div>
                    )}
                  </div>
                  {/* Stock */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Supplier Stock</p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold">
                      {p.health === "HEALTHY" && (
                        <><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> <span className="text-emerald-700 dark:text-emerald-400">In Stock</span></>
                      )}
                      {p.health === "PARTIAL" && (
                        <><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> <span className="text-amber-700 dark:text-amber-400">Low Stock</span></>
                      )}
                      {p.health === "OUT_OF_STOCK" && (
                        <><span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> <span className="text-rose-700 dark:text-rose-400">Out of Stock</span></>
                      )}
                      {p.health === "PROVIDER_PAUSED" && (
                        <><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> <span className="text-amber-700 dark:text-amber-400">Paused</span></>
                      )}
                      {p.health === "MANUAL" && (
                        <><span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> <span className="text-sky-700 dark:text-sky-400">Direct</span></>
                      )}
                      {p.health === "EMPTY" && (
                        <><span className="h-1.5 w-1.5 rounded-full bg-zinc-400" /> <span className="text-[var(--fg-muted)]">Empty</span></>
                      )}
                    </div>
                  </div>
                  {/* Status */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Status</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <button
                        onClick={(e) => handleToggleActive(p.id, e)}
                        className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${p.isActive ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"}`}
                      >
                        <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${p.isActive ? "translate-x-3.5" : "translate-x-0"}`} />
                      </button>
                      <span className="text-xs font-medium text-[var(--fg-muted)]">{p.isActive ? "Active" : "Paused"}</span>
                    </div>
                  </div>
                </div>

                {/* Footer: Actions */}
                <div className="mt-3.5 flex gap-2.5 pt-2.5 border-t border-[var(--border)]">
                  <Link
                    href={`/${locale}/admin/catalog/${p.id}`}
                    className="flex-1 rounded-xl bg-[var(--surface-2)] py-2 text-center text-xs font-bold text-[var(--fg)] hover:bg-[var(--border)] transition shadow-2xs"
                  >
                    Studio ⚙️
                  </Link>
                  <Link
                    href={`/${locale}/products/${p.slug}`}
                    target="_blank"
                    className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2 text-center text-xs font-semibold text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] transition shadow-2xs"
                  >
                    View Store ↗
                  </Link>
                </div>
              </div>
            );
          })}
          {sortedProducts.length === 0 && (
            <div className="px-4 py-12 text-center text-[var(--fg-muted)]">
              <p className="text-base font-semibold">No products found</p>
              <p className="text-xs mt-1">Try adjusting your search query or category filter</p>
            </div>
          )}
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
