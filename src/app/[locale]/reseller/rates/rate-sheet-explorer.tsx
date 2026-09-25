"use client";

import { useState } from "react";
import Link from "next/link";
import { ProductArt } from "@/lib/product-images";
import type { RateSheetItem } from "@/components/ResellerCockpit";
import type { Locale } from "@/i18n";

export function RateSheetExplorer({
  locale,
  tierName,
  discountPercent,
  rateSheet,
  dzdRate,
}: {
  locale: Locale;
  tierName: string;
  discountPercent: number;
  rateSheet: RateSheetItem[];
  dzdRate: number;
}) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const categories = ["ALL", ...Array.from(new Set(rateSheet.map((i) => i.category)))];

  const filtered = rateSheet.filter((item) => {
    const matchesCategory = selectedCategory === "ALL" || item.category === selectedCategory;
    const matchesSearch =
      search.trim() === "" ||
      item.productName.toLowerCase().includes(search.toLowerCase()) ||
      item.variantLabel.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Filter Card */}
      <div className="flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--elev-1)] sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                ⭐ {tierName} Rate Sheet
              </span>
              <span className="text-xs font-medium text-[var(--fg-muted)]">
                {discountPercent}% Wholesale Margin
              </span>
            </div>
            <h1 className="mt-1.5 text-xl font-bold tracking-tight text-[var(--fg)] sm:text-2xl">
              Wholesale Pricing & Margins Catalog
            </h1>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              Live wholesale rates for all active products. Conversion rate: 1 USD = {dzdRate} DZD.
            </p>
          </div>

          <div className="shrink-0">
            <span className="inline-flex rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold text-[var(--fg-muted)]">
              {filtered.length} Variants Available
            </span>
          </div>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products or variants (e.g. Free Fire, Netflix, PUBG, Canva)..."
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-xs text-[var(--fg)] placeholder:text-[var(--fg-faint)] focus:border-emerald-500 focus:outline-none sm:text-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCategory(c)}
                className={`shrink-0 rounded-full px-3 py-1 font-semibold capitalize transition-all whitespace-nowrap ${
                  selectedCategory === c
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-[var(--surface-2)] text-[var(--fg-muted)] hover:bg-[var(--surface-3,var(--surface-2))] hover:text-[var(--fg)]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile View: High-density Touch Cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {filtered.map((item) => {
          const retailDzd = Math.round((item.retailPriceMinor / 100) * dzdRate);
          const wholesaleDzd = Math.round((item.wholesalePriceMinor / 100) * dzdRate);
          const marginDzd = retailDzd - wholesaleDzd;

          return (
            <div
              key={item.offerId}
              className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs"
            >
              {/* Product Header */}
              <div className="flex items-start gap-3">
                <div className="shrink-0">
                  <ProductArt id={item.productSlug} size={36} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-bold text-[var(--fg)]">
                      {item.productName}
                    </h3>
                    <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold capitalize text-[var(--fg-muted)]">
                      {item.category}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
                    {item.variantLabel}
                  </p>
                </div>
              </div>

              {/* Price & Margin Matrix */}
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-[var(--surface-2)] p-2.5 text-center text-xs">
                <div>
                  <span className="text-[10px] font-medium text-[var(--fg-faint)]">Retail</span>
                  <div className="mt-0.5 font-bold text-[var(--fg-muted)] line-through">
                    {retailDzd.toLocaleString()} DA
                  </div>
                  <span className="text-[10px] text-[var(--fg-faint)]">
                    ${(item.retailPriceMinor / 100).toFixed(2)}
                  </span>
                </div>

                <div className="border-x border-[var(--border)]">
                  <span className="text-[10px] font-medium text-[var(--fg-faint)]">Wholesale</span>
                  <div className="mt-0.5 font-bold text-emerald-600 dark:text-emerald-400">
                    {wholesaleDzd.toLocaleString()} DA
                  </div>
                  <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                    ${(item.wholesalePriceMinor / 100).toFixed(2)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-medium text-[var(--fg-faint)]">Profit</span>
                  <div className="mt-0.5 font-bold text-emerald-600 dark:text-emerald-400">
                    +{marginDzd.toLocaleString()} DA
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-500">
                    +{item.marginPercent.toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Quick Order Button */}
              <Link
                href={`/${locale}/products/${item.productSlug}`}
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-500 active:scale-98"
              >
                <span>Order Wholesale</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--fg-muted)]">
            No products or variants matched your query.
          </div>
        )}
      </div>

      {/* Desktop View: Compact Full-width Table */}
      <div className="hidden md:block overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--elev-1)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              <tr>
                <th className="px-3 py-2.5">Product & Variant</th>
                <th className="hidden xl:table-cell px-3 py-2.5">Category</th>
                <th className="px-2.5 py-2.5 whitespace-nowrap">Retail Price</th>
                <th className="px-2.5 py-2.5 whitespace-nowrap">Wholesale Cost</th>
                <th className="px-2.5 py-2.5 whitespace-nowrap text-emerald-600 dark:text-emerald-400">Profit Margin</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((item) => {
                const retailDzd = Math.round((item.retailPriceMinor / 100) * dzdRate);
                const wholesaleDzd = Math.round((item.wholesalePriceMinor / 100) * dzdRate);
                const marginDzd = retailDzd - wholesaleDzd;

                return (
                  <tr key={item.offerId} className="transition-colors hover:bg-[var(--surface-2)]/60">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="shrink-0">
                          <ProductArt id={item.productSlug} size={28} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-[var(--fg)] truncate max-w-[170px] lg:max-w-[200px] xl:max-w-[280px]">
                            {item.productName}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-[var(--fg-muted)]">
                            <span className="truncate max-w-[140px]">{item.variantLabel}</span>
                            <span className="xl:hidden rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.2 text-[9px] font-semibold capitalize">
                              {item.category}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden xl:table-cell px-3 py-2 whitespace-nowrap">
                      <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold capitalize text-[var(--fg-muted)]">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 text-[var(--fg-muted)] whitespace-nowrap">
                      <div className="line-through text-xs">{retailDzd.toLocaleString()} DA</div>
                      <div className="text-[10px] text-[var(--fg-faint)]">
                        ${(item.retailPriceMinor / 100).toFixed(2)}
                      </div>
                    </td>
                    <td className="px-2.5 py-2 font-bold text-[var(--fg)] whitespace-nowrap">
                      <div className="text-xs">{wholesaleDzd.toLocaleString()} DA</div>
                      <div className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        ${(item.wholesalePriceMinor / 100).toFixed(2)}
                      </div>
                    </td>
                    <td className="px-2.5 py-2 font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      <div className="text-xs">+{marginDzd.toLocaleString()} DA</div>
                      <div className="text-[10px] font-medium text-emerald-500/90">
                        +{item.marginPercent.toFixed(1)}% margin
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Link
                        href={`/${locale}/products/${item.productSlug}`}
                        className="inline-flex h-7 items-center justify-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-500 active:scale-95"
                      >
                        Order →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-[var(--fg-muted)]">
                    No products or variants matched your query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
