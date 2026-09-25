"use client";

import { useState, useTransition } from "react";
import { adjustUserBalance, updateUserRoleAndTier } from "./actions";

export type SerializedWalletTxn = {
  id: string;
  type: string;
  amountMinor: string;
  balanceAfterMinor: string;
  reference: string | null;
  note: string | null;
  createdAt: string;
};

export type SerializedUser = {
  id: string;
  email: string;
  role: string;
  tierId: string | null;
  tierName: string | null;
  preferredLocale: string;
  telegramId: string | null;
  telegramUsername: string | null;
  balanceMinor: string;
  ordersCount: number;
  createdAt: string;
  recentTxns: SerializedWalletTxn[];
};

export type SerializedTierOption = {
  id: string;
  name: string;
  discountPercent: string;
};

const ROLE_TABS = ["ALL", "CUSTOMER", "RESELLER_APPLICANT", "RESELLER", "ADMIN"] as const;

function roleBadgeClass(role: string) {
  switch (role) {
    case "ADMIN":
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
    case "RESELLER":
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
    case "RESELLER_APPLICANT":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "CUSTOMER":
    default:
      return "bg-[var(--surface-2)] text-[var(--fg-muted)] border-[var(--border)]";
  }
}

export function UserDirectory({
  users: initialUsers,
  tiers,
  dzdRate = 240,
}: {
  users: SerializedUser[];
  tiers: SerializedTierOption[];
  dzdRate?: number;
}) {
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTxnUser, setActiveTxnUser] = useState<SerializedUser | null>(null);

  // Balance adjustment modal state
  const [adjustModalUser, setAdjustModalUser] = useState<SerializedUser | null>(null);
  const [adjustDirection, setAdjustDirection] = useState<"credit" | "debit">("credit");
  const [adjustAmountDollars, setAdjustAmountDollars] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  // Role & Tier modal state
  const [roleModalUser, setRoleModalUser] = useState<SerializedUser | null>(null);
  const [targetRole, setTargetRole] = useState<string>("CUSTOMER");
  const [targetTierId, setTargetTierId] = useState<string>("");

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // KPI calculations
  const totalLiabilityMinor = initialUsers.reduce(
    (sum, u) => sum + BigInt(u.balanceMinor),
    0n,
  );
  const totalLiabilityUsd = Number(totalLiabilityMinor) / 100;
  const resellerCount = initialUsers.filter((u) => u.role === "RESELLER").length;
  const applicantCount = initialUsers.filter((u) => u.role === "RESELLER_APPLICANT").length;

  // Filter users
  const filteredUsers = initialUsers.filter((u) => {
    const matchesRole = selectedRole === "ALL" || u.role === selectedRole;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      u.email.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q) ||
      (u.telegramUsername ?? "").toLowerCase().includes(q);
    return matchesRole && matchesSearch;
  });

  const handleBalanceAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalUser) return;
    const dollars = parseFloat(adjustAmountDollars);
    if (!dollars || dollars <= 0) return;
    const amountMinor = Math.round(dollars * 100);

    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("userId", adjustModalUser.id);
      fd.append("direction", adjustDirection);
      fd.append("amountMinor", amountMinor.toString());
      fd.append("reason", adjustReason.trim());

      const res = await adjustUserBalance(fd);
      if ("error" in res && res.error) {
        setActionError(`Balance adjustment failed: ${res.error}`);
      } else if ("ok" in res && res.ok) {
        setActionSuccess(
          `Successfully ${adjustDirection === "credit" ? "credited" : "debited"} $${dollars.toFixed(2)} to ${adjustModalUser.email}! New balance: $${(Number(res.balanceAfterMinor) / 100).toFixed(2)}`,
        );
        setAdjustModalUser(null);
        setAdjustAmountDollars("");
        setAdjustReason("");
      }
    });
  };

  const handleRoleTierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleModalUser) return;

    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("userId", roleModalUser.id);
      fd.append("role", targetRole);
      if (targetRole === "RESELLER" && targetTierId) {
        fd.append("tierId", targetTierId);
      }

      const res = await updateUserRoleAndTier(fd);
      if ("error" in res && res.error) {
        setActionError(`Failed to update role/tier: ${res.error}`);
      } else if ("ok" in res && res.ok) {
        setActionSuccess(`Role updated for ${roleModalUser.email} to ${targetRole}!`);
        setRoleModalUser(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <div className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider">
            Total Users
          </div>
          <div className="mt-1 text-2xl font-bold text-[var(--fg)]">
            {initialUsers.length}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <div className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider">
            Wallet Liability
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            ${totalLiabilityUsd.toFixed(2)}
          </div>
          <div className="text-[11px] text-[var(--fg-muted)] mt-0.5">
            ≈ {Math.round(totalLiabilityUsd * dzdRate).toLocaleString()} DZD
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <div className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider">
            Active Resellers
          </div>
          <div className="mt-1 text-2xl font-bold text-purple-600 dark:text-purple-400">
            {resellerCount}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <div className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider">
            Pending Applicants
          </div>
          <div className="mt-1 text-2xl font-bold text-amber-500">
            {applicantCount}
          </div>
        </div>
      </div>

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

      {/* Filter and Search */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap gap-1.5 items-center">
          {ROLE_TABS.map((tab) => {
            const isActive = selectedRole === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setSelectedRole(tab)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-[var(--fg)] text-[var(--bg)] shadow-sm"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {tab === "ALL" ? "All Users" : tab.replace(/_/g, " ")}
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search email, ID, telegram..."
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

      {/* Users Table Container */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        {/* Desktop View (Table) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-2)] text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Wallet Balance</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredUsers.map((user) => {
                const balUsd = Number(user.balanceMinor) / 100;
                const balDzd = balUsd * dzdRate;

                return (
                  <tr key={user.id} className="hover:bg-[var(--surface-2)]/50 transition">
                    <td className="px-4 py-3 text-xs">
                      <div className="font-bold text-[var(--fg)]">{user.email}</div>
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--fg-muted)] mt-0.5">
                        <span>{user.id.slice(0, 12)}...</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(user.id, `uid-${user.id}`)}
                          className="hover:text-[var(--fg)]"
                          title="Copy User ID"
                        >
                          {copiedKey === `uid-${user.id}` ? "✓" : "📋"}
                        </button>
                        {user.telegramUsername && (
                          <span className="text-sky-500 font-sans">@{user.telegramUsername}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${roleBadgeClass(
                          user.role,
                        )}`}
                      >
                        {user.role.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {user.tierName ? (
                        <span className="rounded border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[11px] font-bold text-purple-600 dark:text-purple-400">
                          {user.tierName}
                        </span>
                      ) : (
                        <span className="text-[var(--fg-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-mono font-bold text-[var(--fg)]">${balUsd.toFixed(2)}</div>
                      <div className="text-[10px] text-[var(--fg-muted)]">
                        ≈ {Math.round(balDzd).toLocaleString()} DZD
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono font-medium">
                      {user.ordersCount}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--fg-muted)]">
                      {user.createdAt.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustModalUser(user);
                            setAdjustDirection("credit");
                            setAdjustAmountDollars("");
                            setAdjustReason("");
                          }}
                          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition"
                          title="Credit or Debit Balance"
                        >
                          💰 Adjust
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRoleModalUser(user);
                            setTargetRole(user.role);
                            setTargetTierId(user.tierId ?? (tiers[0]?.id || ""));
                          }}
                          className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-semibold hover:border-[var(--fg-muted)] transition"
                          title="Change Role or Tier"
                        >
                          🏷️ Role
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTxnUser(user)}
                          className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-semibold hover:border-[var(--fg-muted)] transition"
                          title="View Ledger History"
                        >
                          📜 Ledger
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-[var(--fg-muted)]">
                    No users found matching this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View (Cards) */}
        <div className="md:hidden divide-y divide-[var(--border)]">
          {filteredUsers.map((user) => {
            const balUsd = Number(user.balanceMinor) / 100;
            const balDzd = balUsd * dzdRate;

            return (
              <div key={user.id} className="p-4 transition-colors hover:bg-[var(--surface-2)]/50">
                {/* Header: User & Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-[var(--fg)] truncate">{user.email}</div>
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--fg-muted)] mt-0.5">
                      <span>{user.id.slice(0, 10)}...</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(user.id, `uid-${user.id}`)}
                        className="hover:text-[var(--fg)]"
                        title="Copy User ID"
                      >
                        {copiedKey === `uid-${user.id}` ? "✓" : "📋"}
                      </button>
                      {user.telegramUsername && (
                        <span className="text-sky-500 font-sans">@{user.telegramUsername}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${roleBadgeClass(
                        user.role,
                      )}`}
                    >
                      {user.role.replace(/_/g, " ")}
                    </span>
                    {user.tierName && (
                      <span className="rounded border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                        {user.tierName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Grid: Balance & Orders */}
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-[var(--surface-2)]/40 p-2.5 border border-[var(--border)] text-xs">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Balance</span>
                    <div className="font-mono font-bold text-[var(--fg)]">${balUsd.toFixed(2)}</div>
                    <div className="text-[9px] text-[var(--fg-muted)]">≈ {Math.round(balDzd).toLocaleString()} DZD</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Orders</span>
                    <div className="font-mono font-bold text-[var(--fg)]">{user.ordersCount}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Joined</span>
                    <div className="text-[11px] text-[var(--fg-muted)]">{user.createdAt.slice(0, 10)}</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustModalUser(user);
                      setAdjustDirection("credit");
                      setAdjustAmountDollars("");
                      setAdjustReason("");
                    }}
                    className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition"
                  >
                    💰 Adjust
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRoleModalUser(user);
                      setTargetRole(user.role);
                      setTargetTierId(user.tierId ?? (tiers[0]?.id || ""));
                    }}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] py-1.5 text-center text-xs font-semibold hover:border-[var(--fg-muted)] transition"
                  >
                    🏷️ Role
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTxnUser(user)}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] py-1.5 text-center text-xs font-semibold hover:border-[var(--fg-muted)] transition"
                  >
                    📜 Ledger
                  </button>
                </div>
              </div>
            );
          })}
          {filteredUsers.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-[var(--fg-muted)]">
              No users found matching this filter.
            </div>
          )}
        </div>
      </div>

      {/* Manual Balance Adjustment Modal */}
      {adjustModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={handleBalanceAdjustSubmit}
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-[var(--fg)]">
                💰 Manual Balance Adjustment
              </h3>
              <button
                type="button"
                onClick={() => setAdjustModalUser(null)}
                className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-1 text-xs">
              <div>
                <span className="text-[var(--fg-muted)]">Target User: </span>
                <span className="font-bold text-[var(--fg)]">{adjustModalUser.email}</span>
              </div>
              <div>
                <span className="text-[var(--fg-muted)]">Current Balance: </span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  ${(Number(adjustModalUser.balanceMinor) / 100).toFixed(2)} USD
                </span>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustDirection("credit")}
                className={`rounded-xl border p-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  adjustDirection === "credit"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--fg-muted)] hover:bg-[var(--surface)]"
                }`}
              >
                <span>➕ Credit (Add Funds)</span>
              </button>
              <button
                type="button"
                onClick={() => setAdjustDirection("debit")}
                className={`rounded-xl border p-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  adjustDirection === "debit"
                    ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-sm"
                    : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--fg-muted)] hover:bg-[var(--surface)]"
                }`}
              >
                <span>➖ Debit (Deduct Funds)</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--fg)]">
                Amount in USD ($):
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--fg-muted)]">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={adjustAmountDollars}
                  onChange={(e) => setAdjustAmountDollars(e.target.value)}
                  placeholder="25.00"
                  className="w-full text-xs font-mono font-bold rounded-xl border border-[var(--border)] bg-[var(--surface-2)] pl-7 pr-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--fg)]">
                Mandatory Audit Justification / Reason:
              </label>
              <input
                type="text"
                required
                minLength={3}
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g. In-person cash deposit CCP #48291, Goodwill adjustment"
                className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Projected Balance Preview */}
            {adjustAmountDollars && !isNaN(parseFloat(adjustAmountDollars)) && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-3 text-xs flex items-center justify-between">
                <span className="text-[var(--fg-muted)]">Projected Balance:</span>
                <span className="font-mono font-bold text-[var(--fg)]">
                  ${(
                    Number(adjustModalUser.balanceMinor) / 100 +
                    (adjustDirection === "credit" ? 1 : -1) * parseFloat(adjustAmountDollars)
                  ).toFixed(2)}{" "}
                  USD
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setAdjustModalUser(null)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !adjustAmountDollars || !adjustReason.trim()}
                className={`rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-50 ${
                  adjustDirection === "credit"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-rose-600 hover:bg-rose-500"
                }`}
              >
                {isPending ? "Processing..." : `Confirm ${adjustDirection === "credit" ? "Credit" : "Debit"}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Role & Tier Modal */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={handleRoleTierSubmit}
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-[var(--fg)]">
                🏷️ Update User Role & Tier
              </h3>
              <button
                type="button"
                onClick={() => setRoleModalUser(null)}
                className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs">
              <span className="text-[var(--fg-muted)]">Target User: </span>
              <span className="font-bold text-[var(--fg)]">{roleModalUser.email}</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--fg)]">Assign Role:</label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 text-xs font-medium focus:border-emerald-500 focus:outline-none"
              >
                <option value="CUSTOMER">CUSTOMER (Standard Buyer)</option>
                <option value="RESELLER_APPLICANT">RESELLER APPLICANT (Pending Review)</option>
                <option value="RESELLER">RESELLER (Wholesale Tier Privileges)</option>
                <option value="ADMIN">ADMIN (Full Panel Control)</option>
              </select>
            </div>

            {targetRole === "RESELLER" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--fg)]">
                  Assign Reseller Tier:
                </label>
                <select
                  value={targetTierId}
                  onChange={(e) => setTargetTierId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 text-xs font-medium focus:border-purple-500 focus:outline-none"
                >
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.discountPercent}% Discount)
                    </option>
                  ))}
                  {tiers.length === 0 && (
                    <option value="">No tiers defined yet (create in Resellers)</option>
                  )}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setRoleModalUser(null)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-500 disabled:opacity-50"
              >
                {isPending ? "Updating..." : "Save Role & Tier"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ledger History Modal */}
      {activeTxnUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="text-base font-bold text-[var(--fg)]">
                  📜 Wallet Ledger & Audit History
                </h3>
                <div className="text-xs text-[var(--fg-muted)]">{activeTxnUser.email}</div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTxnUser(null)}
                className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {activeTxnUser.recentTxns.map((txn) => {
                const amount = Number(txn.amountMinor) / 100;
                const isPositive = amount > 0;

                return (
                  <div
                    key={txn.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-3 text-xs flex items-start justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--fg)]">{txn.type}</span>
                        {txn.reference && (
                          <span className="font-mono text-[11px] text-[var(--fg-muted)]">
                            Ref: {txn.reference}
                          </span>
                        )}
                      </div>
                      {txn.note && (
                        <div className="text-[var(--fg-muted)] mt-1">{txn.note}</div>
                      )}
                      <div className="text-[10px] text-[var(--fg-muted)] mt-1">
                        {new Date(txn.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`font-mono font-bold text-sm ${
                          isPositive ? "text-emerald-500" : "text-rose-500"
                        }`}
                      >
                        {isPositive ? "+" : ""}${amount.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-[var(--fg-muted)]">
                        Balance: ${(Number(txn.balanceAfterMinor) / 100).toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })}

              {activeTxnUser.recentTxns.length === 0 && (
                <div className="text-center py-8 text-xs text-[var(--fg-muted)]">
                  No transactions recorded on this wallet yet.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setActiveTxnUser(null)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface)]"
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

