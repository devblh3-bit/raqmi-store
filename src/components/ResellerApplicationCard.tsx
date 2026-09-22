"use client";

import { useActionState, useState } from "react";
import { submitResellerApplication, type ResellerApplyResult } from "@/app/actions/reseller";

export function ResellerApplicationCard({
  status,
}: {
  status: "NONE" | "PENDING";
}) {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState<ResellerApplyResult | null, FormData>(
    submitResellerApplication,
    null,
  );

  if (status === "PENDING" || state?.ok) {
    return (
      <div className="mt-4 overflow-hidden rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-xl">
            ⏳
          </div>
          <div>
            <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
              Wholesale Application Under Review
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-amber-800/90 dark:text-amber-300/90">
              Your application for the Raqmi Wholesale & Reseller Program has been submitted! Our admin team reviews applications and assigns wholesale discount tiers. You will see your wholesale rates appear here as soon as it is approved.
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              Status: Pending Administrator Review
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[var(--surface-2)] p-6 shadow-[var(--elev-1)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--accent)]">
            <span>💼</span> Wholesale Program
          </div>
          <h3 className="mt-2 text-base font-bold tracking-tight text-[var(--fg)]">
            Run a Digital Shop or Gaming Page?
          </h3>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Apply to become a verified Reseller and unlock exclusive wholesale discounts (10% - 20%), bulk price sheets, and prioritized key delivery.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] px-5 text-xs font-bold text-white shadow-xs transition-all duration-200 hover:bg-[var(--accent-hover)] active:scale-95"
        >
          {open ? "Close Form" : "Apply for Reseller Tier"}
        </button>
      </div>

      {open && (
        <form action={action} className="mt-6 border-t border-[var(--border)] pt-5">
          {state && !state.ok && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-medium text-red-600 dark:text-red-400">
              ⚠️ {state.error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="businessName" className="block text-xs font-semibold text-[var(--fg)]">
                Store or Page Name <span className="text-red-500">*</span>
              </label>
              <input
                id="businessName"
                name="businessName"
                type="text"
                required
                placeholder="e.g. DZ Gaming Store / Karim Top-ups"
                className="mt-1.5 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--fg)] placeholder:text-[var(--fg-faint)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            <div>
              <label htmlFor="contact" className="block text-xs font-semibold text-[var(--fg)]">
                Contact Handle / Phone <span className="text-red-500">*</span>
              </label>
              <input
                id="contact"
                name="contact"
                type="text"
                required
                placeholder="e.g. Telegram @my_handle or 0555123456"
                className="mt-1.5 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--fg)] placeholder:text-[var(--fg-faint)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="note" className="block text-xs font-semibold text-[var(--fg)]">
              Brief Overview / Products of Interest (Optional)
            </label>
            <textarea
              id="note"
              name="note"
              rows={2}
              placeholder="Tell us what you sell (Free Fire diamonds, PUBG UC, Netflix, Steam cards, etc.) and your estimated monthly volume..."
              className="mt-1.5 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--fg)] placeholder:text-[var(--fg-faint)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full px-4 py-2 text-xs font-medium text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-9 items-center justify-center rounded-full bg-[var(--accent)] px-5 text-xs font-bold text-white shadow-xs transition-all duration-200 hover:bg-[var(--accent-hover)] active:scale-95 disabled:opacity-50"
            >
              {isPending ? "Submitting..." : "Submit Application"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
