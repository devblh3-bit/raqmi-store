"use client";

import { useState, useTransition } from "react";
import {
  retryOrderItem,
  manualFulfillItem,
  refundOrderItem,
  refundOrder,
} from "./actions";

export type SerializedFulfillmentAttempt = {
  id: string;
  providerOfferId: string;
  providerCode: string;
  providerSku: string;
  status: string;
  errorCode: string | null;
  attemptedAt: string;
};

export type SerializedProviderOrder = {
  id: string;
  providerCode: string;
  providerOrderId: string | null;
  clientOrderId: string;
  status: string;
  errorCode: string | null;
  errorDetail: string | null;
  attempts: number;
  lastPolledAt: string | null;
  nextPollAt: string | null;
};

export type SerializedAccountDelivery = {
  login?: string;
  password?: string;
  extra?: Record<string, string>;
  raw?: unknown;
};

export type SerializedOrderItem = {
  id: string;
  offerId: string;
  offerLabelEn: string;
  offerLabelAr: string;
  offerLabelFr: string;
  quantity: number;
  unitPriceMinor: string;
  unitCostMinor: string;
  costCurrency: string;
  requiresCustomerInput: boolean;
  customerInput: string | null;
  customerInputDecrypted: boolean;
  manualDeliveryPayload: string | null;
  providerAccounts: SerializedAccountDelivery[] | null;
  status: string;
  attemptCount: number;
  attempts: SerializedFulfillmentAttempt[];
  providerOrders: SerializedProviderOrder[];
};

export type SerializedOrder = {
  id: string;
  code: string;
  userId: string | null;
  userEmail: string | null;
  guestEmail: string | null;
  totalMinor: string;
  currency: string;
  status: string;
  paymentStatus: string;
  locale: string;
  createdAt: string;
  items: SerializedOrderItem[];
};

const STATUS_TABS = [
  "ALL",
  "PENDING",
  "PAID",
  "PLACED_WITH_PROVIDER",
  "COMPLETED",
  "PARTIALLY_DELIVERED",
  "FAILED",
  "REFUNDED",
] as const;

function statusBadgeClass(status: string) {
  switch (status) {
    case "COMPLETED":
    case "SUCCEEDED":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "FAILED":
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
    case "REFUNDED":
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
    case "PLACED":
    case "PLACED_WITH_PROVIDER":
    case "AWAITING_SELLER":
    case "AWAITING_ACTIVATION":
      return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
    case "PAID":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "PENDING":
    case "AWAITING_FULFILLMENT":
    default:
      return "bg-[var(--surface-2)] text-[var(--fg-muted)] border-[var(--border)]";
  }
}

export function OrderManager({
  orders: initialOrders,
  dzdRate = 240,
  initialStatus = "ALL",
}: {
  orders: SerializedOrder[];
  dzdRate?: number;
  initialStatus?: string;
}) {
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatus);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeOrder, setActiveOrder] = useState<SerializedOrder | null>(null);

  // Modal states
  const [manualModalItem, setManualModalItem] = useState<SerializedOrderItem | null>(null);
  const [manualPayloadText, setManualPayloadText] = useState("");
  const [refundItemModal, setRefundItemModal] = useState<{ item: SerializedOrderItem; order: SerializedOrder } | null>(null);
  const [refundOrderModal, setRefundOrderModal] = useState<SerializedOrder | null>(null);
  const [refundReason, setRefundReason] = useState("");

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Filter orders
  const filteredOrders = initialOrders.filter((o) => {
    const matchesStatus =
      selectedStatus === "ALL" ||
      o.status.toUpperCase() === selectedStatus.toUpperCase() ||
      (selectedStatus.toUpperCase() === "FAILED" && o.items.some((it) => it.status === "FAILED"));

    const matchesSearch =
      !searchQuery.trim() ||
      o.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.userEmail ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.guestEmail ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.items.some((it) => it.offerLabelEn.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesSearch;
  });

  // Keep activeOrder synced if order list revalidates
  const currentActiveOrder = activeOrder
    ? initialOrders.find((o) => o.id === activeOrder.id) ?? activeOrder
    : null;

  // Handlers
  const handleRetryItem = (orderItemId: string) => {
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("orderItemId", orderItemId);
      const res = await retryOrderItem(fd);
      if ("error" in res && res.error) {
        setActionError(`Retry failed: ${res.error}`);
      } else {
        setActionSuccess("Fulfillment dispatch re-triggered successfully!");
      }
    });
  };

  const handleManualFulfill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualModalItem || !manualPayloadText.trim()) return;
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("orderItemId", manualModalItem.id);
      fd.append("payload", manualPayloadText.trim());
      const res = await manualFulfillItem(fd);
      if ("error" in res && res.error) {
        setActionError(`Manual delivery failed: ${res.error}`);
      } else {
        setActionSuccess("Item fulfilled and marked COMPLETED!");
        setManualModalItem(null);
        setManualPayloadText("");
      }
    });
  };

  const handleRefundItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundItemModal) return;
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("orderItemId", refundItemModal.item.id);
      if (refundReason.trim()) fd.append("reason", refundReason.trim());
      const res = await refundOrderItem(fd);
      if ("error" in res && res.error) {
        setActionError(`Refund failed: ${res.error}`);
      } else if ("ok" in res && res.ok) {
        setActionSuccess(`Item refunded successfully! Credited $${(Number(res.amountMinor) / 100).toFixed(2)} to customer wallet.`);
        setRefundItemModal(null);
        setRefundReason("");
      }
    });
  };

  const handleRefundOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundOrderModal) return;
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("orderId", refundOrderModal.id);
      if (refundReason.trim()) fd.append("reason", refundReason.trim());
      const res = await refundOrder(fd);
      if ("error" in res && res.error) {
        setActionError(`Order refund failed: ${res.error}`);
      } else if ("ok" in res && res.ok) {
        setActionSuccess(`Order refunded successfully! Credited $${(Number(res.amountMinor) / 100).toFixed(2)} to customer wallet.`);
        setRefundOrderModal(null);
        setRefundReason("");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {actionError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="font-bold text-xs opacity-80 hover:opacity-100">✕</button>
        </div>
      )}
      {actionSuccess && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="font-bold text-xs opacity-80 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Top Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap gap-1.5 items-center">
          {STATUS_TABS.map((tab) => {
            const isActive = selectedStatus === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setSelectedStatus(tab)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-[var(--fg)] text-[var(--bg)] shadow-sm"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {tab === "ALL" ? "All Orders" : tab.replace(/_/g, " ")}
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search code, email, variant..."
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs placeholder:text-[var(--fg-muted)] focus:border-emerald-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        
        {/* Desktop View (Table) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-2)] text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              <tr>
                <th className="px-4 py-3">Order Code</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total & Profit</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredOrders.map((order) => {
                const totalUsd = Number(order.totalMinor) / 100;
                const totalDzd = totalUsd * dzdRate;
                const totalCost = order.items.reduce(
                  (acc, it) => acc + (Number(it.unitCostMinor) / 100) * it.quantity,
                  0,
                );
                const grossProfit = totalUsd - totalCost;
                const marginPercent = totalUsd > 0 ? (grossProfit / totalUsd) * 100 : 0;

                return (
                  <tr
                    key={order.id}
                    className="hover:bg-[var(--surface-2)]/50 transition cursor-pointer"
                    onClick={() => setActiveOrder(order)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {order.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-medium text-[var(--fg)]">
                        {order.userEmail ?? order.guestEmail ?? "Guest"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex flex-wrap gap-1">
                        {order.items.map((it) => (
                          <span
                            key={it.id}
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(
                              it.status,
                            )}`}
                          >
                            <span>{it.offerLabelEn}</span>
                            <span className="opacity-70">×{it.quantity}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-mono font-bold">${totalUsd.toFixed(2)}</div>
                      <div className="text-[10px] text-[var(--fg-muted)]">
                        ≈ {Math.round(totalDzd).toLocaleString()} DZD
                        {grossProfit !== 0 && (
                          <span
                            className={`ml-1.5 font-semibold ${
                              grossProfit > 0 ? "text-emerald-500" : "text-rose-500"
                            }`}
                          >
                            ({grossProfit > 0 ? "+" : ""}${grossProfit.toFixed(2)}, {marginPercent.toFixed(0)}%)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(
                          order.status,
                        )}`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--fg-muted)]">
                      {order.createdAt.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveOrder(order);
                        }}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold hover:border-emerald-500 transition"
                      >
                        Inspect 🔍
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-[var(--fg-muted)]">
                    No orders found matching this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View (Cards) */}
        <div className="sm:hidden divide-y divide-[var(--border)]">
          {filteredOrders.map((order) => {
            const totalUsd = Number(order.totalMinor) / 100;
            const totalDzd = totalUsd * dzdRate;
            const totalCost = order.items.reduce(
              (acc, it) => acc + (Number(it.unitCostMinor) / 100) * it.quantity,
              0,
            );
            const grossProfit = totalUsd - totalCost;
            const marginPercent = totalUsd > 0 ? (grossProfit / totalUsd) * 100 : 0;

            return (
              <div
                key={order.id}
                className="p-4 transition-colors hover:bg-[var(--surface-2)]/50 cursor-pointer"
                onClick={() => setActiveOrder(order)}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {order.code}
                  </span>
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(
                      order.status,
                    )}`}
                  >
                    {order.status}
                  </span>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 mb-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Customer</p>
                    <div className="mt-0.5 text-xs font-medium text-[var(--fg)]">
                      {order.userEmail ?? order.guestEmail ?? "Guest"}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Date</p>
                    <div className="mt-0.5 text-xs text-[var(--fg-muted)]">
                      {order.createdAt.slice(0, 10)}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Total Amount</p>
                    <div className="mt-0.5 text-sm font-mono font-bold text-[var(--fg)]">
                      ${totalUsd.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Profit</p>
                    <div className="mt-0.5 text-[11px] font-mono">
                      {grossProfit !== 0 ? (
                        <span className={`font-bold ${grossProfit > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                          {grossProfit > 0 ? "+" : ""}${grossProfit.toFixed(2)} ({marginPercent.toFixed(0)}%)
                        </span>
                      ) : (
                        <span className="text-[var(--fg-muted)]">N/A</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="pt-3 border-t border-[var(--border)]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)] mb-2">Order Items</p>
                  <div className="flex flex-wrap gap-1.5">
                    {order.items.map((it) => (
                      <span
                        key={it.id}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(
                          it.status,
                        )}`}
                      >
                        <span>{it.offerLabelEn}</span>
                        <span className="opacity-70">×{it.quantity}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Inspect Button */}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveOrder(order);
                    }}
                    className="w-full rounded-xl bg-[var(--surface-2)] py-2 text-center text-xs font-bold text-[var(--fg)] shadow-sm hover:border-emerald-500 hover:text-emerald-500 transition"
                  >
                    Inspect Order 🔍
                  </button>
                </div>
              </div>
            );
          })}
          {filteredOrders.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-[var(--fg-muted)]">
              No orders found matching this filter.
            </div>
          )}
        </div>
      </div>

      {/* Decrypted Order Inspection Slide-Over Drawer */}
      {currentActiveOrder && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl bg-[var(--surface)] h-full overflow-y-auto border-l border-[var(--border)] p-6 shadow-2xl space-y-6">
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-[var(--border)] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {currentActiveOrder.code}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(currentActiveOrder.code, "code")}
                    className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
                    title="Copy Order Code"
                  >
                    {copiedKey === "code" ? "✓ Copied" : "📋"}
                  </button>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(
                      currentActiveOrder.status,
                    )}`}
                  >
                    {currentActiveOrder.status}
                  </span>
                  <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-xs font-mono">
                    {currentActiveOrder.paymentStatus}
                  </span>
                </div>
                <div className="text-xs text-[var(--fg-muted)] mt-1">
                  Placed on {new Date(currentActiveOrder.createdAt).toLocaleString()} · Locale: {currentActiveOrder.locale}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveOrder(null)}
                className="rounded-lg p-1.5 text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Customer Information Card */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                Customer & Billing Information
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[var(--fg-muted)]">Email: </span>
                  <span className="font-medium">{currentActiveOrder.userEmail ?? currentActiveOrder.guestEmail ?? "—"}</span>
                </div>
                <div>
                  <span className="text-[var(--fg-muted)]">User ID: </span>
                  <span className="font-mono">{currentActiveOrder.userId ?? "Guest checkout"}</span>
                </div>
                <div>
                  <span className="text-[var(--fg-muted)]">Order Total: </span>
                  <span className="font-bold text-[var(--fg)]">
                    ${(Number(currentActiveOrder.totalMinor) / 100).toFixed(2)} (≈{" "}
                    {Math.round((Number(currentActiveOrder.totalMinor) / 100) * dzdRate).toLocaleString()} DZD)
                  </span>
                </div>
                <div>
                  <span className="text-[var(--fg-muted)]">Refund Status: </span>
                  <span className="font-semibold">
                    {currentActiveOrder.status === "REFUNDED" ? "Fully Refunded" : "Active"}
                  </span>
                </div>
              </div>

              {/* Order Full Refund Action */}
              {currentActiveOrder.userId && currentActiveOrder.status !== "REFUNDED" && (
                <div className="pt-2 border-t border-[var(--border)] flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setRefundOrderModal(currentActiveOrder);
                      setRefundReason("");
                    }}
                    className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition"
                  >
                    💰 Refund Entire Order to Wallet
                  </button>
                </div>
              )}
            </div>

            {/* Items Section */}
            <div className="space-y-4">
              <div className="text-sm font-bold text-[var(--fg)]">
                Order Items ({currentActiveOrder.items.length})
              </div>

              {currentActiveOrder.items.map((item, idx) => {
                const itemPrice = Number(item.unitPriceMinor) / 100;
                const itemCost = Number(item.unitCostMinor) / 100;
                const itemProfit = (itemPrice - itemCost) * item.quantity;
                const itemMargin = itemPrice > 0 ? ((itemPrice - itemCost) / itemPrice) * 100 : 0;

                const isStalledOrFailed = [
                  "FAILED",
                  "AWAITING_FULFILLMENT",
                  "PLACED",
                  "AWAITING_SELLER",
                  "AWAITING_ACTIVATION",
                ].includes(item.status);

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4 shadow-sm"
                  >
                    {/* Item Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--fg-muted)]">#{idx + 1}</span>
                          <span className="text-sm font-bold text-[var(--fg)]">{item.offerLabelEn}</span>
                          <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs font-mono">
                            ×{item.quantity}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(
                              item.status,
                            )}`}
                          >
                            {item.status}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--fg-muted)] mt-1">
                          Selling: ${(itemPrice * item.quantity).toFixed(2)} · Wholesale: ${(itemCost * item.quantity).toFixed(2)} · Profit:{" "}
                          <span className={itemProfit >= 0 ? "text-emerald-500 font-semibold" : "text-rose-500 font-semibold"}>
                            ${itemProfit.toFixed(2)} ({itemMargin.toFixed(0)}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Decrypted Customer Input Card */}
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/50 p-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[var(--fg-muted)] font-semibold">
                        <span>👤 Customer Submitted Input / Credentials:</span>
                        {item.customerInput && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.customerInput!, `cin-${item.id}`)}
                            className="text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            {copiedKey === `cin-${item.id}` ? "✓ Copied" : "Copy"}
                          </button>
                        )}
                      </div>
                      {item.customerInput ? (
                        <div className="font-mono text-xs bg-[var(--surface)] border border-[var(--border)] p-2 rounded break-all text-[var(--fg)]">
                          {item.customerInput}
                        </div>
                      ) : (
                        <div className="italic text-[var(--fg-muted)]">
                          {item.requiresCustomerInput
                            ? "Input was required but none stored"
                            : "No customer input required for this variant"}
                        </div>
                      )}
                    </div>

                    {/* Decrypted Delivery Credentials */}
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between font-semibold text-emerald-700 dark:text-emerald-400">
                        <span>🔑 Delivered Credentials & Account Keys:</span>
                        {item.manualDeliveryPayload && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.manualDeliveryPayload!, `man-${item.id}`)}
                            className="hover:underline"
                          >
                            {copiedKey === `man-${item.id}` ? "✓ Copied" : "Copy"}
                          </button>
                        )}
                      </div>

                      {/* Manual delivery text */}
                      {item.manualDeliveryPayload && (
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-[var(--fg-muted)]">
                            Manually Delivered:
                          </span>
                          <pre className="font-mono text-xs bg-[var(--surface)] border border-[var(--border)] p-2 rounded break-all whitespace-pre-wrap text-[var(--fg)]">
                            {item.manualDeliveryPayload}
                          </pre>
                        </div>
                      )}

                      {/* Provider automated accounts */}
                      {item.providerAccounts && item.providerAccounts.length > 0 && (
                        <div className="space-y-2 mt-2">
                          <span className="text-[10px] uppercase font-bold text-[var(--fg-muted)]">
                            Provider Accounts Delivered:
                          </span>
                          {item.providerAccounts.map((acc, aIdx) => (
                            <div
                              key={aIdx}
                              className="rounded border border-[var(--border)] bg-[var(--surface)] p-2 font-mono text-xs space-y-1"
                            >
                              {acc.login && <div><span className="text-[var(--fg-muted)]">Login:</span> {acc.login}</div>}
                              {acc.password && <div><span className="text-[var(--fg-muted)]">Pass:</span> {acc.password}</div>}
                              {acc.extra &&
                                Object.entries(acc.extra).map(([k, v]) => (
                                  <div key={k}><span className="text-[var(--fg-muted)]">{k}:</span> {v}</div>
                                ))}
                            </div>
                          ))}
                        </div>
                      )}

                      {!item.manualDeliveryPayload && (!item.providerAccounts || item.providerAccounts.length === 0) && (
                        <div className="italic text-[var(--fg-muted)]">
                          {item.status === "COMPLETED"
                            ? "Delivered without stored credentials (service completed)"
                            : "Awaiting delivery credentials"}
                        </div>
                      )}
                    </div>

                    {/* Fulfillment History Timeline */}
                    {item.attempts.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                          Fulfillment Attempts ({item.attempts.length})
                        </div>
                        <div className="space-y-1">
                          {item.attempts.map((att) => (
                            <div
                              key={att.id}
                              className="flex items-center justify-between rounded border border-[var(--border)] bg-[var(--surface-2)]/40 px-2.5 py-1.5 text-xs font-mono"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[var(--fg)]">{att.providerCode}</span>
                                <span className={`rounded px-1.5 py-0.5 text-[10px] ${statusBadgeClass(att.status)}`}>
                                  {att.status}
                                </span>
                                {att.errorCode && (
                                  <span className="text-rose-500 text-[11px]">
                                    ({att.errorCode})
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-[var(--fg-muted)]">
                                {new Date(att.attemptedAt).toLocaleTimeString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)]">
                      {isStalledOrFailed && (
                        <>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleRetryItem(item.id)}
                            className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold hover:border-emerald-500 transition disabled:opacity-50"
                          >
                            🔄 Retry Dispatch
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                              setManualModalItem(item);
                              setManualPayloadText("");
                            }}
                            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50"
                          >
                            ✍️ Manual Delivery
                          </button>
                        </>
                      )}

                      {currentActiveOrder.userId && item.status !== "REFUNDED" && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => {
                            setRefundItemModal({ item, order: currentActiveOrder });
                            setRefundReason("");
                          }}
                          className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition disabled:opacity-50 ml-auto"
                        >
                          💰 Refund Item to Wallet
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Manual Delivery Modal */}
      {manualModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={handleManualFulfill}
            className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-[var(--fg)]">
                ✍️ Manual Key / Account Delivery
              </h3>
              <button
                type="button"
                onClick={() => setManualModalItem(null)}
                className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-semibold text-[var(--fg-muted)]">Target Variant:</div>
              <div className="text-sm font-bold">{manualModalItem.offerLabelEn}</div>
            </div>

            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-[var(--fg-muted)]">
              🔒 <span className="font-semibold text-emerald-600 dark:text-emerald-400">AES-256-GCM Encryption:</span> Credentials will be encrypted at rest with envelope encryption and immediately made available to the buyer.
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--fg)]">
                Delivery Payload / Keys / Accounts:
              </label>
              <textarea
                required
                rows={5}
                value={manualPayloadText}
                onChange={(e) => setManualPayloadText(e.target.value)}
                placeholder="Example:&#10;Email: account@email.com&#10;Password: SecretPassword123&#10;Profile: Pin 1234&#10;Warranty: 30 Days"
                className="w-full font-mono text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setManualModalItem(null)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !manualPayloadText.trim()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
              >
                {isPending ? "Encrypting & Delivering..." : "Deliver & Mark Completed"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Item Refund Modal */}
      {refundItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={handleRefundItem}
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-[var(--fg)]">
                💰 Refund Item to Wallet
              </h3>
              <button
                type="button"
                onClick={() => setRefundItemModal(null)}
                className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--fg-muted)]">Item:</span>
                <span className="font-bold">{refundItemModal.item.offerLabelEn}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--fg-muted)]">Quantity:</span>
                <span>{refundItemModal.item.quantity}</span>
              </div>
              <div className="flex justify-between border-t border-purple-500/20 pt-2 text-sm font-bold text-purple-600 dark:text-purple-400">
                <span>Refund Amount:</span>
                <span>
                  $
                  {(
                    (Number(refundItemModal.item.unitPriceMinor) / 100) *
                    refundItemModal.item.quantity
                  ).toFixed(2)}{" "}
                  USD
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--fg)]">
                Reason / Internal Audit Note (Optional):
              </label>
              <input
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g. Supplier out of stock, customer requested refund"
                className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setRefundItemModal(null)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-500 disabled:opacity-50"
              >
                {isPending ? "Processing Refund..." : "Confirm Wallet Credit"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Full Order Refund Modal */}
      {refundOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={handleRefundOrder}
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-[var(--fg)]">
                💰 Refund Entire Order to Wallet
              </h3>
              <button
                type="button"
                onClick={() => setRefundOrderModal(null)}
                className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--fg-muted)]">Order:</span>
                <span className="font-mono font-bold">{refundOrderModal.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--fg-muted)]">Non-Refunded Items:</span>
                <span>
                  {refundOrderModal.items.filter((i) => i.status !== "REFUNDED").length}
                </span>
              </div>
              <div className="flex justify-between border-t border-purple-500/20 pt-2 text-sm font-bold text-purple-600 dark:text-purple-400">
                <span>Total Wallet Credit:</span>
                <span>
                  $
                  {(
                    refundOrderModal.items
                      .filter((i) => i.status !== "REFUNDED")
                      .reduce(
                        (sum, i) => sum + (Number(i.unitPriceMinor) / 100) * i.quantity,
                        0,
                      )
                  ).toFixed(2)}{" "}
                  USD
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--fg)]">
                Reason / Internal Audit Note (Optional):
              </label>
              <input
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g. Cancelled by admin, full order refund"
                className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setRefundOrderModal(null)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-500 disabled:opacity-50"
              >
                {isPending ? "Processing Refund..." : "Confirm Full Refund"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
