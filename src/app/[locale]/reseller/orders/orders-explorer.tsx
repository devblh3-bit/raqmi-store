"use client";

import { useState } from "react";
import Link from "next/link";
import { Price } from "@/components/Price";
import { CopyButton } from "@/components/CopyButton";
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)] sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              📦 Fulfillment History
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--fg)]">
              Wholesale Orders & Key Deliveries
            </h1>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              Access all fulfilled digital keys and accounts. 1-click copy directly to clipboard to forward to your clients.
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs font-semibold text-[var(--fg-faint)]">
              {filtered.length} Orders
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order code (#RQ-...) or product name..."
            className="flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-sm text-[var(--fg)] placeholder:text-[var(--fg-faint)] focus:border-[var(--accent)] focus:outline-none"
          />

          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs sm:pb-0">
            {["ALL", "COMPLETED", "AWAITING_FULFILLMENT", "FAILED"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(s)}
                className={`rounded-full px-3 py-1.5 font-semibold transition-all ${
                  filterStatus === s
                    ? "bg-[var(--accent)] text-white shadow-xs"
                    : "bg-[var(--surface-2)] text-[var(--fg-muted)] hover:bg-[var(--surface-3,var(--surface-2))] hover:text-[var(--fg)]"
                }`}
              >
                {s === "ALL" ? "All Statuses" : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)] sm:p-8">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-[var(--fg-muted)]">No orders found matching your criteria.</p>
            <Link
              href={`/${locale}/products`}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-[var(--accent)] px-5 text-xs font-bold text-white shadow-xs transition-all hover:bg-[var(--accent-hover)]"
            >
              Place Wholesale Order
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((o) => (
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
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        o.status === "COMPLETED"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : o.status === "FAILED"
                          ? "bg-red-500/10 text-red-600 dark:text-red-400"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {o.status}
                    </span>
                    <span className="text-xs font-bold">
                      <Price cents={o.totalMinor} locale={locale} size="sm" />
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
