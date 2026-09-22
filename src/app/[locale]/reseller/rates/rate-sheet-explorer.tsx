"use client";

import { useState } from "react";
import Link from "next/link";
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
      <div className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)] sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                ⭐ {tierName} Rate Sheet
              </span>
              <span className="text-xs font-medium text-[var(--fg-muted)]">
                {discountPercent}% Wholesale Margin
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--fg)]">
              Wholesale Pricing & Margins Catalog
            </h1>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              Live wholesale rates for all active products. Conversion rate: 1 USD = {dzdRate} DZD.
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs font-semibold text-[var(--fg-faint)]">
              {filtered.length} Variants Available
            </span>
          </div>
        </div>

        {/* Search & Category Filter */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products or variants (e.g. Free Fire, Netflix, PUBG, Steam)..."
            className="flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-sm text-[var(--fg)] placeholder:text-[var(--fg-faint)] focus:border-[var(--accent)] focus:outline-none"
          />

          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs sm:pb-0">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCategory(c)}
                className={`rounded-full px-3 py-1.5 font-semibold capitalize transition-all ${
                  selectedCategory === c
                    ? "bg-[var(--accent)] text-white shadow-xs"
                    : "bg-[var(--surface-2)] text-[var(--fg-muted)] hover:bg-[var(--surface-3,var(--surface-2))] hover:text-[var(--fg)]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Full-width Rate Sheet Table */}
      <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--elev-1)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] font-semibold text-[var(--fg-muted)]">
              <tr>
                <th className="px-5 py-3.5">Product & Variant</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Retail Price</th>
                <th className="px-4 py-3.5">Wholesale Cost</th>
                <th className="px-4 py-3.5 text-emerald-600 dark:text-emerald-400">Profit Margin</th>
                <th className="px-5 py-3.5 text-right">Quick Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((item) => {
                const retailDzd = Math.round((item.retailPriceMinor / 100) * dzdRate);
                const wholesaleDzd = Math.round((item.wholesalePriceMinor / 100) * dzdRate);
                const marginDzd = retailDzd - wholesaleDzd;

                return (
                  <tr key={item.offerId} className="transition-colors hover:bg-[var(--surface-2)]/60">
                    <td className="px-5 py-4">
                      <div className="font-bold text-[var(--fg)]">{item.productName}</div>
                      <div className="text-[11px] text-[var(--fg-muted)]">{item.variantLabel}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-0.5 text-[10px] font-semibold capitalize text-[var(--fg-muted)]">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[var(--fg-muted)] line-through">
                      {retailDzd.toLocaleString()} DZD
                      <span className="block text-[10px] text-[var(--fg-faint)]">
                        ${(item.retailPriceMinor / 100).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-bold text-[var(--fg)]">
                      {wholesaleDzd.toLocaleString()} DZD
                      <span className="block text-[10px] text-emerald-600 dark:text-emerald-400">
                        ${(item.wholesalePriceMinor / 100).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-bold text-emerald-600 dark:text-emerald-400">
                      +{marginDzd.toLocaleString()} DZD
                      <span className="block text-[10px] text-emerald-500/80">
                        +{item.marginPercent.toFixed(1)}% margin
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/${locale}/products/${item.productSlug}`}
                        className="inline-flex h-8 items-center justify-center rounded-full bg-[var(--accent)] px-4 text-xs font-bold text-white shadow-xs transition-all duration-200 hover:bg-[var(--accent-hover)] active:scale-95"
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

