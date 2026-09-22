"use client";

import { useState } from "react";

export type SerializedAuditLog = {
  id: string;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  entity: string;
  entityId: string;
  detail: unknown;
  createdAt: string;
};

const ACTION_TABS = [
  "ALL",
  "ORDER",
  "OFFER",
  "USER",
  "TIER",
  "CATEGORY",
  "DEPOSIT",
] as const;

function actionBadgeClass(action: string) {
  if (action.includes("APPROVED") || action.includes("CREATED") || action.includes("COMPLETED")) {
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  }
  if (action.includes("REJECTED") || action.includes("DELETED") || action.includes("FAILED")) {
    return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
  }
  if (action.includes("ADJUSTED") || action.includes("REFUNDED")) {
    return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
  }
  if (action.includes("FULFILL") || action.includes("RETRY") || action.includes("DISPATCH")) {
    return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
  }
  return "bg-[var(--surface-2)] text-[var(--fg-muted)] border-[var(--border)]";
}

export function AuditExplorer({ logs }: { logs: SerializedAuditLog[] }) {
  const [selectedTab, setSelectedTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectLog, setInspectLog] = useState<SerializedAuditLog | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesTab =
      selectedTab === "ALL" || log.action.toUpperCase().includes(selectedTab.toUpperCase());

    const q = searchQuery.toLowerCase();
    const detailStr = log.detail ? JSON.stringify(log.detail).toLowerCase() : "";
    const matchesSearch =
      !q ||
      log.action.toLowerCase().includes(q) ||
      (log.actorEmail ?? "").toLowerCase().includes(q) ||
      log.entity.toLowerCase().includes(q) ||
      log.entityId.toLowerCase().includes(q) ||
      detailStr.includes(q);

    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Search & Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 items-center">
          {ACTION_TABS.map((tab) => {
            const isActive = selectedTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setSelectedTab(tab)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-[var(--fg)] text-[var(--bg)] shadow-sm"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {tab === "ALL" ? "All Actions" : tab}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search action, actor, entity ID, JSON..."
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs placeholder:text-[var(--fg-muted)] focus:border-purple-500 focus:outline-none"
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

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-2)] text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target Entity</th>
                <th className="px-4 py-3">Entity ID</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[var(--surface-2)]/50 transition">
                  <td className="px-4 py-3 text-xs font-mono text-[var(--fg-muted)]">
                    <div>{new Date(log.createdAt).toLocaleDateString()}</div>
                    <div className="text-[11px]">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-bold text-[var(--fg)]">
                      {log.actorEmail ?? "System Worker"}
                    </div>
                    {log.actorRole && (
                      <span className="text-[10px] text-[var(--fg-muted)] font-mono">
                        {log.actorRole}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md border px-2.5 py-0.5 text-[11px] font-mono font-semibold ${actionBadgeClass(
                        log.action,
                      )}`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-[var(--fg)]">
                    {log.entity}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-[var(--fg-muted)]">
                    <div className="flex items-center gap-1.5">
                      <span>{log.entityId.slice(0, 14)}...</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(log.entityId, log.id)}
                        className="hover:text-[var(--fg)]"
                        title="Copy Entity ID"
                      >
                        {copiedId === log.id ? "✓" : "📋"}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {log.detail ? (
                      <button
                        type="button"
                        onClick={() => setInspectLog(log)}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-semibold hover:border-purple-500 transition"
                      >
                        View JSON 🔍
                      </button>
                    ) : (
                      <span className="text-xs text-[var(--fg-muted)]">—</span>
                    )}
                  </td>
                </tr>
              ))}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-[var(--fg-muted)]">
                    No audit records match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Detail Inspection Modal */}
      {inspectLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="text-base font-bold text-[var(--fg)]">
                  Audit Action Details: {inspectLog.action}
                </h3>
                <div className="text-xs text-[var(--fg-muted)] font-mono">
                  Target: {inspectLog.entity} ({inspectLog.entityId})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4">
              <pre className="font-mono text-xs text-[var(--fg)] whitespace-pre-wrap break-all">
                {JSON.stringify(inspectLog.detail, null, 2)}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
              <span className="text-xs text-[var(--fg-muted)]">
                Recorded at {new Date(inspectLog.createdAt).toLocaleString()} by {inspectLog.actorEmail ?? "System"}
              </span>
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
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

