"use client";

import { useState } from "react";
import Link from "next/link";
import { Price } from "@/components/Price";
import { CopyButton } from "@/components/CopyButton";
import { ProductArt } from "@/lib/product-images";
import type { DeliveredOrderItem } from "@/components/ResellerCockpit";
import type { Locale } from "@/i18n";

export function ResellerOrdersExplorer({
  locale,
  orders,
}: {
  locale: Locale;
  orders: DeliveredOrderItem[];
}) {
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [search, setSearch] = useState("");

  const filtered = orders.filter((o) => {
    const matchesStatus = filterStatus === "ALL" || o.status === filterStatus;
    const matchesSearch =
      search.trim() === "" ||
      o.orderCode.toLowerCase().includes(search.toLowerCase()) ||
      o.productName.toLowerCase().includes(search.toLowerCase()) ||
      o.variantLabel.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
      case "PAID":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "FAILED":
      case "CANCELLED":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30";
      case "AWAITING_FULFILLMENT":
      case "PROCESSING":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
      default:
        return "bg-[var(--surface-2)] text-[var(--fg-muted)] border-[var(--border)]";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Filter Card */}
      <div className="flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--elev-1)] sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              📦 Fulfillment History
            </span>
            <h1 className="mt-1.5 text-xl font-bold tracking-tight text-[var(--fg)] sm:text-2xl">
              Wholesale Orders & Key Deliveries
            </h1>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              Access all fulfilled digital keys and accounts. 1-click copy directly to clipboard to forward to your clients.
            </p>
          </div>

          <div className="shrink-0">
            <span className="inline-flex rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold text-[var(--fg-muted)]">
              {filtered.length} Orders
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order code (#RQ-...) or product name..."
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-xs text-[var(--fg)] placeholder:text-[var(--fg-faint)] focus:border-emerald-500 focus:outline-none sm:text-sm"
          />

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
            {["ALL", "COMPLETED", "AWAITING_FULFILLMENT", "FAILED"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(s)}
                className={`shrink-0 rounded-full px-3 py-1 font-semibold transition-all whitespace-nowrap ${
                  filterStatus === s
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-[var(--surface-2)] text-[var(--fg-muted)] hover:bg-[var(--surface-3,var(--surface-2))] hover:text-[var(--fg)]"
                }`}
              >
                {s === "ALL" ? "All Statuses" : s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--elev-1)] sm:p-7">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-2xl">
              📦
            </div>
            <p className="mt-3 text-sm font-semibold text-[var(--fg)]">No orders found matching your criteria</p>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">Place a new wholesale order from our catalog to get started.</p>
            <Link
              href={`/${locale}/products`}
              className="mt-4 inline-flex h-9 items-center justify-center rounded-full bg-emerald-600 px-5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-500 active:scale-95"
            >
              Browse Catalog with Wholesale Rates
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((o) => (
              <li
                key={o.id}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-4 transition-all hover:border-[var(--border-strong)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {o.productSlug && (
                      <div className="shrink-0">
                        <ProductArt id={o.productSlug} size={28} />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[var(--fg)]" dir="ltr">
                          {o.orderCode}
                        </span>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${getStatusBadge(
                            o.status,
                          )}`}
                        >
                          {o.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--fg-muted)]">
                        {o.productName} ({o.variantLabel})
                        {o.quantity > 1 && ` × ${o.quantity}`}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold">
                      <Price cents={o.totalMinor} locale={locale} size="sm" />
                    </div>
                    <span className="text-[10px] text-[var(--fg-faint)]">
                      {o.createdAt.slice(0, 10)}
                    </span>
                  </div>
                </div>

                {/* Delivered Key Box */}
                {o.deliveredPayload && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <div className="min-w-0 flex-1 truncate font-mono text-xs select-all text-[var(--fg)]">
                      <span className="select-none text-[var(--fg-faint)]">🔑 Credentials: </span>
                      {o.deliveredPayload}
                    </div>
                    <CopyButton text={o.deliveredPayload} label="Copy Credentials" />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
