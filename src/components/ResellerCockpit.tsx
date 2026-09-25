"use client";

import { useState } from "react";
import Link from "next/link";
import { Price } from "./Price";
import type { Locale } from "@/i18n";

export type ResellerTierInfo = {
  id: string;
  name: string;
  discountPercent: number;
  minDepositMinor: number;
};

export type RateSheetItem = {
  offerId: string;
  productSlug: string;
  productName: string;
  variantLabel: string;
  category: string;
  retailPriceMinor: number;
  wholesalePriceMinor: number;
  marginMinor: number;
  marginPercent: number;
};

export type DeliveredOrderItem = {
  id: string;
  orderCode: string;
  createdAt: string;
  status: string;
  productName: string;
  productSlug?: string;
  variantLabel: string;
  quantity: number;
  totalMinor: number;
  deliveredPayload?: string | null;
};

export function ResellerCockpit({
  locale,
  tier,
  rateSheet,
  orders,
  dzdRate = 240,
}: {
  locale: Locale;
  tier: ResellerTierInfo;
  rateSheet: RateSheetItem[];
  orders: DeliveredOrderItem[];
  dzdRate?: number;
}) {
  const [showRateSheet, setShowRateSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredItems = rateSheet.filter(
    (item) =>
      item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.variantLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Reseller VIP Status Card */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-[var(--surface)] to-[var(--surface-2)] p-6 shadow-[var(--elev-1)] sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-2xl text-white shadow-md">
              ⭐
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  Wholesale Partner
                </span>
                <span className="text-xs font-medium text-[var(--fg-muted)]">
                  {tier.discountPercent}% Off Catalog
                </span>
              </div>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--fg)]">
                {tier.name} Tier Active
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowRateSheet(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 text-xs font-bold text-emerald-700 shadow-xs transition-all duration-200 hover:bg-emerald-500 hover:text-white dark:text-emerald-300 active:scale-95"
            >
              <span>📋</span> Open Wholesale Rate Sheet
            </button>
            <Link
              href={`/${locale}/wallet`}
              className="inline-flex h-10 items-center justify-center rounded-full bg-[var(--accent)] px-5 text-xs font-bold text-white shadow-xs transition-all duration-200 hover:bg-[var(--accent-hover)] active:scale-95"
            >
              + Top-up Balance
            </Link>
          </div>
        </div>
      </div>

      {/* Delivered Orders & 1-Click Key Copier */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)] sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold tracking-tight text-[var(--fg)]">
              Wholesale Order History & Key Delivery
            </h3>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              Fast 1-click credential copying for quick client forwarding on Telegram / WhatsApp.
            </p>
          </div>
          <span className="text-xs font-semibold text-[var(--fg-faint)]">
            {orders.length} Recent Orders
          </span>
        </div>

        {orders.length === 0 ? (
          <div className="mt-6 text-center">
            <p className="text-sm text-[var(--fg-muted)]">No wholesale orders placed yet.</p>
            <Link
              href={`/${locale}/products`}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-[var(--accent)] px-5 text-xs font-bold text-white shadow-xs transition-all hover:bg-[var(--accent-hover)]"
            >
              Browse Wholesale Products
            </Link>
          </div>
        ) : (
          <ul className="mt-5 flex flex-col gap-3">
            {orders.map((o) => (
              <li
                key={o.id}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 transition-all hover:border-[var(--border-strong)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[var(--fg)]" dir="ltr">
                      {o.orderCode}
                    </span>
                    <span className="text-xs font-medium text-[var(--fg-muted)]">
                      · {o.productName} ({o.variantLabel})
                      {o.quantity > 1 && ` × ${o.quantity}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      {o.status}
                    </span>
                    <span className="text-xs font-bold">
                      <Price cents={o.totalMinor} locale={locale} size="sm" />
                    </span>
                  </div>
                </div>

                {/* Delivered Key / Credential Box */}
                {o.deliveredPayload && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <div className="min-w-0 flex-1 font-mono text-xs text-[var(--fg)] select-all truncate">
                      <span className="text-[var(--fg-faint)] select-none">🔑 Delivered: </span>
                      {o.deliveredPayload}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(o.id, o.deliveredPayload!)}
                      className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-all duration-200 active:scale-95 ${
                        copiedId === o.id
                          ? "bg-emerald-600 text-white"
                          : "border border-emerald-500/40 bg-emerald-500/20 text-emerald-800 hover:bg-emerald-500 hover:text-white dark:text-emerald-200"
                      }`}
                    >
                      {copiedId === o.id ? (
                        <>
                          <span>✓</span> Copied!
                        </>
                      ) : (
                        <>
                          <span>📋</span> Copy Credentials
                        </>
                      )}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Wholesale Rate Sheet Modal */}
      {showRateSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
              <div>
                <h3 className="text-lg font-bold text-[var(--fg)]">
                  📋 Wholesale Rate Sheet (Price List)
                </h3>
                <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
                  Live wholesale pricing with your {tier.name} discount applied ({tier.discountPercent}%).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRateSheet(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
              >
                ✕
              </button>
            </div>

            <div className="mt-4">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products or variants (e.g. Free Fire, Netflix, PUBG, Steam)..."
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-sm text-[var(--fg)] placeholder:text-[var(--fg-faint)] focus:border-[var(--accent)] focus:outline-none"
              />
            </div>

            <div className="mt-4 flex-1 overflow-y-auto rounded-2xl border border-[var(--border)]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[var(--surface-2)] border-b border-[var(--border)] font-semibold text-[var(--fg-muted)]">
                  <tr>
                    <th className="px-4 py-3">Product / Variant</th>
                    <th className="px-3 py-3">Retail Price</th>
                    <th className="px-3 py-3">Your Wholesale Cost</th>
                    <th className="px-3 py-3 text-emerald-600 dark:text-emerald-400">Profit Margin</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredItems.map((item) => {
                    const retailDzd = Math.round((item.retailPriceMinor / 100) * dzdRate);
                    const wholesaleDzd = Math.round((item.wholesalePriceMinor / 100) * dzdRate);
                    const marginDzd = retailDzd - wholesaleDzd;

                    return (
                      <tr key={item.offerId} className="hover:bg-[var(--surface-2)] transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-bold text-[var(--fg)]">{item.productName}</span>
                          <span className="block text-[11px] text-[var(--fg-muted)]">
                            {item.variantLabel} · <span className="capitalize">{item.category}</span>
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[var(--fg-muted)] line-through">
                          {retailDzd.toLocaleString()} DZD
                          <span className="block text-[10px]">
                            (${(item.retailPriceMinor / 100).toFixed(2)})
                          </span>
                        </td>
                        <td className="px-3 py-3 font-bold text-[var(--fg)]">
                          {wholesaleDzd.toLocaleString()} DZD
                          <span className="block text-[10px] text-[var(--fg-muted)]">
                            (${(item.wholesalePriceMinor / 100).toFixed(2)})
                          </span>
                        </td>
                        <td className="px-3 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                          +{marginDzd.toLocaleString()} DZD
                          <span className="block text-[10px] text-emerald-500/80">
                            (+{item.marginPercent.toFixed(1)}%)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/${locale}/products/${item.productSlug}`}
                            className="inline-flex h-7 items-center justify-center rounded-full bg-[var(--accent)] px-3 text-[11px] font-bold text-white transition-all hover:bg-[var(--accent-hover)]"
                          >
                            Order
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-[var(--fg-muted)]">
                        No products match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4 text-xs text-[var(--fg-muted)]">
              <span>Showing {filteredItems.length} wholesale variants</span>
              <button
                type="button"
                onClick={() => setShowRateSheet(false)}
                className="rounded-full bg-[var(--surface-2)] px-4 py-2 font-medium hover:bg-[var(--surface-3,var(--surface-2))]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
