"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  reviewResellerApplication,
  createResellerTier,
  updateResellerTier,
  deleteResellerTier,
  setTierPriceOverride,
  deleteTierPriceOverride,
} from "./actions";

export type SerializedApplicant = {
  id: string;
  email: string;
  telegramUsername: string | null;
  balanceMinor: string;
  ordersCount: number;
  createdAt: string;
};

export type SerializedTier = {
  id: string;
  name: string;
  discountPercent: string;
  minDepositMinor: string;
  membersCount: number;
  overridesCount: number;
};

export type SerializedMatrixOffer = {
  id: string;
  productNameEn: string;
  labelEn: string;
  retailPriceMinor: string;
  costMinor: string;
  markupPercent?: number;
  overrides: Record<string, string>; // tierId -> priceMinor
};

export function ResellerManager({
  locale = "en",
  applicants: initialApplicants,
  tiers: initialTiers,
  offers: initialOffers,
  defaultProfitMargin = 15,
}: {
  locale?: string;
  applicants: SerializedApplicant[];
  tiers: SerializedTier[];
  offers: SerializedMatrixOffer[];
  defaultProfitMargin?: number;
}) {
  const [activeTab, setActiveTab] = useState<"applications" | "tiers" | "matrix">("applications");
  const [matrixSearch, setMatrixSearch] = useState("");

  // Application action state
  const [approveModalUser, setApproveModalUser] = useState<SerializedApplicant | null>(null);
  const [selectedTierId, setSelectedTierId] = useState<string>("");
  const [rejectModalUser, setRejectModalUser] = useState<SerializedApplicant | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  // Tier modal state
  const [isCreateTierOpen, setIsCreateTierOpen] = useState(false);
  const [newTierName, setNewTierName] = useState("");
  const [newTierDiscount, setNewTierDiscount] = useState("");
  const [newTierMinDeposit, setNewTierMinDeposit] = useState("0");

  const [editTier, setEditTier] = useState<SerializedTier | null>(null);
  const [editTierName, setEditTierName] = useState("");
  const [editTierDiscount, setEditTierDiscount] = useState("");
  const [editTierMinDeposit, setEditTierMinDeposit] = useState("");

  // Matrix override modal state
  const [overrideModal, setOverrideModal] = useState<{
    offer: SerializedMatrixOffer;
    tier: SerializedTier;
  } | null>(null);
  const [overridePriceDollars, setOverridePriceDollars] = useState("");

  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Application Handlers
  const handleApprove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveModalUser) return;

    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("userId", approveModalUser.id);
      fd.append("action", "approve");
      if (selectedTierId) fd.append("tierId", selectedTierId);

      const res = await reviewResellerApplication(fd);
      if ("error" in res && res.error) {
        setActionError(`Failed to approve: ${res.error}`);
      } else if ("ok" in res && res.ok) {
        setActionSuccess(`Approved ${approveModalUser.email} as Reseller!`);
        setApproveModalUser(null);
      }
    });
  };

  const handleReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalUser) return;

    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("userId", rejectModalUser.id);
      fd.append("action", "reject");
      if (rejectNote.trim()) fd.append("note", rejectNote.trim());

      const res = await reviewResellerApplication(fd);
      if ("error" in res && res.error) {
        setActionError(`Failed to reject: ${res.error}`);
      } else if ("ok" in res && res.ok) {
        setActionSuccess(`Application for ${rejectModalUser.email} was rejected.`);
        setRejectModalUser(null);
        setRejectNote("");
      }
    });
  };

  // Tier Handlers
  const handleCreateTier = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("name", newTierName.trim());
      fd.append("discountPercent", newTierDiscount);
      fd.append("minDepositMinor", Math.round(parseFloat(newTierMinDeposit || "0") * 100).toString());

      const res = await createResellerTier(fd);
      if ("error" in res && res.error) {
        setActionError(`Tier creation failed: ${res.error}`);
      } else if ("ok" in res && res.ok) {
        setActionSuccess(`Tier "${newTierName}" created successfully!`);
        setIsCreateTierOpen(false);
        setNewTierName("");
        setNewTierDiscount("");
        setNewTierMinDeposit("0");
      }
    });
  };

  const handleUpdateTier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTier) return;
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("tierId", editTier.id);
      fd.append("name", editTierName.trim());
      fd.append("discountPercent", editTierDiscount);
      fd.append("minDepositMinor", Math.round(parseFloat(editTierMinDeposit || "0") * 100).toString());

      const res = await updateResellerTier(fd);
      if ("error" in res && res.error) {
        setActionError(`Failed to update tier: ${res.error}`);
      } else if ("ok" in res && res.ok) {
        setActionSuccess(`Tier "${editTierName}" updated!`);
        setEditTier(null);
      }
    });
  };

  const handleDeleteTier = (tier: SerializedTier) => {
    if (tier.membersCount > 0) {
      setActionError(`Cannot delete "${tier.name}" because it still has ${tier.membersCount} active members.`);
      return;
    }
    if (!confirm(`Are you sure you want to delete the tier "${tier.name}"?`)) return;

    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("tierId", tier.id);
      const res = await deleteResellerTier(fd);
      if ("error" in res && res.error) {
        setActionError(`Failed to delete tier: ${res.error}`);
      } else if ("ok" in res && res.ok) {
        setActionSuccess(`Tier "${tier.name}" deleted!`);
      }
    });
  };

  // Matrix Handlers
  const handleSaveOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideModal) return;
    const dollars = parseFloat(overridePriceDollars);
    if (!dollars || dollars <= 0) return;
    const priceMinor = Math.round(dollars * 100);

    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("offerId", overrideModal.offer.id);
      fd.append("tierId", overrideModal.tier.id);
      fd.append("priceMinor", priceMinor.toString());

      const res = await setTierPriceOverride(fd);
      if ("error" in res && res.error) {
        setActionError(`Failed to set price override: ${res.error}`);
      } else if ("ok" in res && res.ok) {
        setActionSuccess(
          `Wholesale override set to $${dollars.toFixed(2)} for ${overrideModal.offer.labelEn} (${overrideModal.tier.name})!`,
        );
        setOverrideModal(null);
        setOverridePriceDollars("");
      }
    });
  };

  const handleDeleteOverride = (offerId: string, tierId: string, offerName: string, tierName: string) => {
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("offerId", offerId);
      fd.append("tierId", tierId);
      const res = await deleteTierPriceOverride(fd);
      if ("error" in res && res.error) {
        setActionError(`Failed to remove override: ${res.error}`);
      } else if ("ok" in res && res.ok) {
        setActionSuccess(`Override removed for ${offerName} (${tierName}). Restored tier formula discount.`);
      }
    });
  };

  const filteredOffers = initialOffers.filter((o) => {
    const q = matrixSearch.toLowerCase();
    return !q || o.productNameEn.toLowerCase().includes(q) || o.labelEn.toLowerCase().includes(q);
  });

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

      {/* Main Tab Navigation */}
      <div className="flex border-b border-[var(--border)] gap-6">
        <button
          type="button"
          onClick={() => setActiveTab("applications")}
          className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === "applications"
              ? "border-purple-600 text-purple-600 dark:text-purple-400"
              : "border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]"
          }`}
        >
          <span>📥 Applications</span>
          {initialApplicants.length > 0 && (
            <span className="rounded-full bg-amber-500 text-white px-2 py-0.5 text-xs font-bold">
              {initialApplicants.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("tiers")}
          className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === "tiers"
              ? "border-purple-600 text-purple-600 dark:text-purple-400"
              : "border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]"
          }`}
        >
          <span>🏷️ Reseller Tiers</span>
          <span className="rounded-full bg-[var(--surface-2)] text-[var(--fg-muted)] px-2 py-0.5 text-xs">
            {initialTiers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("matrix")}
          className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === "matrix"
              ? "border-purple-600 text-purple-600 dark:text-purple-400"
              : "border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]"
          }`}
        >
          <span>⚡ Wholesale Matrix</span>
        </button>
      </div>

      {/* TAB 1: APPLICATIONS QUEUE */}
      {activeTab === "applications" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--fg)]">
              Pending Reseller Applications ({initialApplicants.length})
            </h2>
            <p className="text-xs text-[var(--fg-muted)]">
              Approve users to unlock discounted wholesale pricing.
            </p>
          </div>

          {initialApplicants.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center text-sm text-[var(--fg-muted)]">
              ✨ No pending reseller applications. Users who apply from their dashboard will appear here.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {initialApplicants.map((applicant) => (
                <div
                  key={applicant.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-sm text-[var(--fg)]">{applicant.email}</div>
                      <div className="text-xs text-[var(--fg-muted)] mt-0.5">
                        Applied on {applicant.createdAt.slice(0, 10)}
                        {applicant.telegramUsername && (
                          <span className="ml-2 text-sky-500 font-medium">
                            @{applicant.telegramUsername}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Pending
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-3">
                    <div>
                      <span className="text-[var(--fg-muted)]">Current Wallet: </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        ${(Number(applicant.balanceMinor) / 100).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--fg-muted)]">Past Orders: </span>
                      <span className="font-bold">{applicant.ordersCount}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setRejectModalUser(applicant);
                        setRejectNote("");
                      }}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold hover:bg-rose-500/10 hover:text-rose-600 transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setApproveModalUser(applicant);
                        setSelectedTierId(initialTiers[0]?.id || "");
                      }}
                      className="rounded-xl bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-500 transition disabled:opacity-50"
                    >
                      Approve Application
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RESELLER TIERS */}
      {activeTab === "tiers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[var(--fg)]">Configured Tiers</h2>
              <p className="text-xs text-[var(--fg-muted)] mt-0.5">
                Each tier grants an automatic percentage discount off catalog retail prices.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreateTierOpen(true)}
              className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-500 transition"
            >
              ➕ Create New Tier
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {initialTiers.map((tier) => (
              <div
                key={tier.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-lg text-[var(--fg)]">{tier.name}</h3>
                    <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-bold text-purple-600 dark:text-purple-400">
                      {tier.discountPercent}% OFF
                    </span>
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[var(--fg-muted)]">Minimum Deposit:</span>
                      <span className="font-mono font-semibold">
                        ${(Number(tier.minDepositMinor) / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--fg-muted)]">Active Members:</span>
                      <span className="font-bold text-[var(--fg)]">{tier.membersCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--fg-muted)]">Fixed Price Overrides:</span>
                      <span className="font-bold text-[var(--fg)]">{tier.overridesCount}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => {
                      setEditTier(tier);
                      setEditTierName(tier.name);
                      setEditTierDiscount(tier.discountPercent);
                      setEditTierMinDeposit((Number(tier.minDepositMinor) / 100).toString());
                    }}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold hover:border-purple-500 transition"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={tier.membersCount > 0 || isPending}
                    onClick={() => handleDeleteTier(tier)}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition disabled:opacity-30"
                    title={tier.membersCount > 0 ? "Cannot delete tier with active members" : "Delete tier"}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {initialTiers.length === 0 && (
              <div className="col-span-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center text-sm text-[var(--fg-muted)]">
                No reseller tiers defined yet. Click &quot;Create New Tier&quot; to set up Bronze, Silver, or Gold wholesale tiers.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: WHOLESALE PRICE OVERRIDE MATRIX */}
      {activeTab === "matrix" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 text-xs text-[var(--fg-muted)] flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <div className="font-bold text-purple-600 dark:text-purple-400">
                ⚡ Fixed Wholesale Price Matrix
              </div>
              <div className="text-[11px] text-[var(--fg-muted)] mt-0.5">
                Fixed price overrides take absolute precedence over percentage discount formulas.
              </div>
              <div className="flex items-center gap-2 pt-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold px-2.5 py-0.5 text-[11px]">
                  📈 Baseline Profit Margin: +{defaultProfitMargin}%
                </span>
                <Link
                  href={`/${locale}/admin/settings`}
                  className="text-purple-600 dark:text-purple-400 hover:underline font-semibold text-[11px]"
                >
                  Configure in Settings ⚙️
                </Link>
              </div>
            </div>

            <div className="w-full md:w-64">
              <input
                type="text"
                value={matrixSearch}
                onChange={(e) => setMatrixSearch(e.target.value)}
                placeholder="Search product variant..."
                className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--surface-2)] text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                  <tr>
                    <th className="px-4 py-3">Product Variant</th>
                    <th className="px-4 py-3">Wholesale Cost</th>
                    <th className="px-4 py-3">Retail Price</th>
                    {initialTiers.map((tier) => (
                      <th key={tier.id} className="px-4 py-3">
                        {tier.name} ({tier.discountPercent}% OFF)
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredOffers.map((offer) => {
                    const costUsd = Number(offer.costMinor) / 100;
                    const retailUsd = Number(offer.retailPriceMinor) / 100;

                    return (
                      <tr key={offer.id} className="hover:bg-[var(--surface-2)]/50 transition">
                        <td className="px-4 py-3 text-xs">
                          <div className="font-bold text-[var(--fg)]">{offer.productNameEn}</div>
                          <div className="text-[var(--fg-muted)] text-[11px]">{offer.labelEn}</div>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-[var(--fg-muted)]">
                          ${costUsd.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono font-bold text-[var(--fg)]">
                          <div>${retailUsd.toFixed(2)}</div>
                          {offer.markupPercent !== undefined && (
                            <span className="block text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              +{offer.markupPercent}% margin
                            </span>
                          )}
                        </td>

                        {initialTiers.map((tier) => {
                          const overrideMinor = offer.overrides[tier.id];
                          const discount = parseFloat(tier.discountPercent) / 100;
                          const formulaPrice = Math.max(costUsd, retailUsd * (1 - discount));

                          return (
                            <td key={tier.id} className="px-4 py-3 text-xs">
                              {overrideMinor ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="rounded border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 font-mono text-xs font-bold text-purple-600 dark:text-purple-400">
                                    ${(Number(overrideMinor) / 100).toFixed(2)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOverrideModal({ offer, tier });
                                      setOverridePriceDollars((Number(overrideMinor) / 100).toString());
                                    }}
                                    className="text-[10px] text-[var(--fg-muted)] hover:text-purple-500"
                                    title="Edit Override"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteOverride(offer.id, tier.id, offer.labelEn, tier.name)
                                    }
                                    className="text-[10px] text-rose-500 hover:text-rose-700 font-bold"
                                    title="Remove Override (Restore formula)"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div>
                                    <span className="font-mono text-xs font-bold text-[var(--fg)]">
                                      ${formulaPrice.toFixed(2)}
                                    </span>
                                    {formulaPrice > costUsd ? (
                                      <span className="block text-[10px] font-medium text-purple-600 dark:text-purple-400 font-mono">
                                        +${(formulaPrice - costUsd).toFixed(2)} profit
                                      </span>
                                    ) : (
                                      <span className="block text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                        At cost ($0 profit)
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOverrideModal({ offer, tier });
                                      setOverridePriceDollars(formulaPrice.toFixed(2));
                                    }}
                                    className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold hover:border-purple-500 hover:text-purple-600 transition"
                                  >
                                    + Override
                                  </button>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {filteredOffers.length === 0 && (
                    <tr>
                      <td colSpan={3 + initialTiers.length} className="px-4 py-12 text-center text-sm text-[var(--fg-muted)]">
                        No offers found matching this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Approve Application Modal */}
      {approveModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={handleApprove}
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-[var(--fg)]">
                ✅ Approve Reseller Application
              </h3>
              <button
                type="button"
                onClick={() => setApproveModalUser(null)}
                className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs">
              <span className="text-[var(--fg-muted)]">Applicant: </span>
              <span className="font-bold">{approveModalUser.email}</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--fg)]">
                Assign Starting Reseller Tier:
              </label>
              <select
                required
                value={selectedTierId}
                onChange={(e) => setSelectedTierId(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 text-xs font-medium focus:border-purple-500 focus:outline-none"
              >
                {initialTiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.discountPercent}% Discount)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setApproveModalUser(null)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-500 disabled:opacity-50"
              >
                {isPending ? "Approving..." : "Confirm Reseller Promotion"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reject Application Modal */}
      {rejectModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={handleReject}
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-[var(--fg)]">
                ❌ Reject Reseller Application
              </h3>
              <button
                type="button"
                onClick={() => setRejectModalUser(null)}
                className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs">
              <span className="text-[var(--fg-muted)]">Applicant: </span>
              <span className="font-bold">{rejectModalUser.email}</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--fg)]">
                Internal Reason / Note (Optional):
              </label>
              <input
                type="text"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="e.g. Account does not meet minimum order history requirement"
                className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setRejectModalUser(null)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-500 disabled:opacity-50"
              >
                {isPending ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Tier Modal */}
      {isCreateTierOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={handleCreateTier}
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-[var(--fg)]">
                ➕ Create Reseller Tier
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateTierOpen(false)}
                className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--fg)]">Tier Name:</label>
              <input
                type="text"
                required
                value={newTierName}
                onChange={(e) => setNewTierName(e.target.value)}
                placeholder="e.g. Gold"
                className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--fg)]">
                Discount Percentage (%):
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                required
                value={newTierDiscount}
                onChange={(e) => setNewTierDiscount(e.target.value)}
                placeholder="10.0"
                className="w-full text-xs font-mono font-bold rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--fg)]">
                Minimum Deposit in USD ($):
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={newTierMinDeposit}
                onChange={(e) => setNewTierMinDeposit(e.target.value)}
                placeholder="100"
                className="w-full text-xs font-mono rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setIsCreateTierOpen(false)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !newTierName.trim() || !newTierDiscount}
                className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-500 disabled:opacity-50"
              >
                {isPending ? "Creating..." : "Create Tier"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Tier Modal */}
      {editTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={handleUpdateTier}
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-[var(--fg)]">
                ✏️ Edit Reseller Tier
              </h3>
              <button
                type="button"
                onClick={() => setEditTier(null)}
                className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--fg)]">Tier Name:</label>
              <input
                type="text"
                required
                value={editTierName}
                onChange={(e) => setEditTierName(e.target.value)}
                className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--fg)]">
                Discount Percentage (%):
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                required
                value={editTierDiscount}
                onChange={(e) => setEditTierDiscount(e.target.value)}
                className="w-full text-xs font-mono font-bold rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--fg)]">
                Minimum Deposit in USD ($):
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={editTierMinDeposit}
                onChange={(e) => setEditTierMinDeposit(e.target.value)}
                className="w-full text-xs font-mono rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setEditTier(null)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !editTierName.trim() || !editTierDiscount}
                className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-500 disabled:opacity-50"
              >
                {isPending ? "Updating..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Set Override Modal */}
      {overrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={handleSaveOverride}
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-[var(--fg)]">
                ⚡ Set Fixed Wholesale Price
              </h3>
              <button
                type="button"
                onClick={() => setOverrideModal(null)}
                className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--fg-muted)]">Product:</span>
                <span className="font-bold">{overrideModal.offer.productNameEn}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--fg-muted)]">Variant:</span>
                <span className="font-semibold">{overrideModal.offer.labelEn}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--fg-muted)]">Wholesale Cost:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  ${(Number(overrideModal.offer.costMinor) / 100).toFixed(2)} USD
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--fg-muted)]">Retail Selling Price:</span>
                <span className="font-mono font-bold">
                  ${(Number(overrideModal.offer.retailPriceMinor) / 100).toFixed(2)} USD
                </span>
              </div>
              <div className="flex justify-between border-t border-[var(--border)] pt-1.5 text-purple-600 dark:text-purple-400 font-bold">
                <span>Target Tier:</span>
                <span>{overrideModal.tier.name}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--fg)]">
                Fixed Wholesale Override Price in USD ($):
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--fg-muted)]">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={overridePriceDollars}
                  onChange={(e) => setOverridePriceDollars(e.target.value)}
                  placeholder="8.50"
                  className="w-full text-xs font-mono font-bold rounded-xl border border-[var(--border)] bg-[var(--surface-2)] pl-7 pr-3 py-2.5 focus:border-purple-500 focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-[var(--fg-muted)]">
                Must be at least the wholesale cost (${(Number(overrideModal.offer.costMinor) / 100).toFixed(2)}) to prevent negative gross margins.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setOverrideModal(null)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !overridePriceDollars}
                className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-500 disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save Override"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
