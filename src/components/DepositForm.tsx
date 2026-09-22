"use client";

import { useActionState, useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { submitDeposit, type DepositState } from "@/app/actions/deposit";
import type { Locale } from "@/i18n";

export interface PaymentAccountsConfig {
  baridimobRip?: string;
  baridimobHolder?: string;
  ccpAccount?: string;
  usdtBep20Address?: string;
  usdtTrc20Address?: string;
  dzdRate?: number;
}

const ERROR_KEY: Record<string, string> = {
  BAD_AMOUNT: "errorAmount",
  BAD_REQUEST: "errorGeneric",
  UNAUTHENTICATED: "errorGeneric",
  UNKNOWN: "errorGeneric",
};

const FIELD =
  "mt-2 h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm font-medium outline-none focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--ring)]";

export default function DepositForm({
  locale,
  paymentAccounts,
  initialAmount = "",
  initialMethod = "MANUAL_BANK",
}: {
  locale: Locale;
  paymentAccounts?: PaymentAccountsConfig;
  initialAmount?: string;
  initialMethod?: string;
}) {
  const t = useTranslations("wallet");
  const [method, setMethod] = useState(initialMethod || "MANUAL_BANK");
  const [amount, setAmount] = useState(initialAmount || "");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // File upload state for payment proof
  const [uploadedUrl, setUploadedUrl] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, action, pending] = useActionState<DepositState, FormData>(submitDeposit, {});

  const isCrypto = method !== "MANUAL_BANK";
  const errorKey = state.error ? (ERROR_KEY[state.error] ?? "errorGeneric") : null;
  const dzdRate = paymentAccounts?.dzdRate || 240;
  const numericAmount = parseFloat(amount) || 0;
  const dzdEquivalent = Math.round(numericAmount * dzdRate);

  async function copyText(text: string, fieldName: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback if clipboard API is blocked
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setFileName(file.name);
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      setUploadedUrl(data.url);
    } catch (err) {
      console.error("Receipt upload error:", err);
      setUploadError("Could not upload receipt image. Please try again.");
      setUploadedUrl("");
    } finally {
      setUploading(false);
    }
  }

  function removeReceipt() {
    setUploadedUrl("");
    setPreviewUrl("");
    setFileName("");
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  if (state.ok) {
    return (
      <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-3">
        <div className="text-4xl">{state.autoConfirmed ? "⚡" : "🎉"}</div>
        <h3 className="text-base font-bold text-emerald-800 dark:text-emerald-200">
          {state.autoConfirmed
            ? "Deposit Confirmed On-Chain! ⚡"
            : t("submitted")}
        </h3>
        <p className="text-xs text-[var(--fg-muted)]">
          {state.autoConfirmed
            ? "Your USDT transaction was verified via NodeReal BSC RPC and credited to your wallet balance instantly!"
            : "An administrator will verify your receipt and credit your wallet. You will see your balance update shortly."}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="proofUrl" value={uploadedUrl} />

      {/* Amount Input with Live DZD Conversion */}
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="amount" className="block text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
            {t("amount")}
          </label>
          {numericAmount > 0 && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              ≈ {dzdEquivalent.toLocaleString()} DZD ({dzdRate} DZD/$)
            </span>
          )}
        </div>
        <div className="relative mt-1">
          <input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="1"
            max="1000000"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="25.00"
            className={FIELD}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--fg-muted)]">
            USD
          </span>
        </div>
      </div>

      {/* Payment Method Selector */}
      <div>
        <label htmlFor="method" className="block text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
          {t("method")}
        </label>
        <select
          id="method"
          name="method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className={FIELD}
        >
          <option value="MANUAL_BANK">🇩🇿 Baridimob / CCP (Algeria Post)</option>
          <option value="USDT_BEP20">₮ USDT (BNB Smart Chain - BEP20)</option>
          <option value="USDT_TRC20">₮ USDT (TRON Network - TRC20)</option>
        </select>
      </div>

      {/* PAYMENT INSTRUCTIONS CARD */}
      {!isCrypto ? (
        /* Algerian Banking (Baridimob & CCP) Instruction Card */
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🇩🇿</span>
              <span className="font-bold text-sm text-[var(--fg)]">
                Baridimob & CCP Payment Instructions
              </span>
            </div>
            <span className="rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 text-[10px]">
              Direct Transfer
            </span>
          </div>

          <p className="text-xs text-[var(--fg-muted)] leading-relaxed">
            Transfer the exact DZD amount to our official Baridimob account, then upload a screenshot of your transfer receipt below.
          </p>

          <div className="space-y-2.5 pt-1 text-xs">
            {/* RIP Field */}
            {paymentAccounts?.baridimobRip ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--fg-muted)] block">
                    Baridimob RIP (20 Digits)
                  </span>
                  <span className="font-mono font-bold text-sm text-[var(--fg)] select-all">
                    {paymentAccounts.baridimobRip}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(paymentAccounts.baridimobRip!, "rip")}
                  className={`inline-flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    copiedField === "rip"
                      ? "bg-emerald-600 text-white"
                      : "bg-[var(--surface-2)] text-[var(--fg)] hover:bg-[var(--surface-3,var(--surface-2))] border border-[var(--border)]"
                  }`}
                >
                  {copiedField === "rip" ? "✓ Copied!" : "📋 Copy RIP"}
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-[11px] text-amber-700 dark:text-amber-300">
                ⚠️ Store Baridimob RIP will be configured by admin. Please contact support if needed.
              </div>
            )}

            {/* Account Holder & CCP details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {paymentAccounts?.baridimobHolder && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
                  <span className="text-[10px] uppercase font-bold text-[var(--fg-muted)] block">
                    Account Holder
                  </span>
                  <span className="font-semibold text-xs text-[var(--fg)]">
                    {paymentAccounts.baridimobHolder}
                  </span>
                </div>
              )}
              {paymentAccounts?.ccpAccount && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
                  <span className="text-[10px] uppercase font-bold text-[var(--fg-muted)] block">
                    CCP Account & Clé
                  </span>
                  <span className="font-mono text-xs text-[var(--fg)]">
                    {paymentAccounts.ccpAccount}
                  </span>
                </div>
              )}
            </div>

            {/* Live Required Amount Indicator */}
            {numericAmount > 0 && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--fg-muted)]">
                  Total to transfer:
                </span>
                <span className="font-mono text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                  {dzdEquivalent.toLocaleString()} DZD
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* USDT Cryptocurrency Instruction Card */
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">₮</span>
              <span className="font-bold text-sm text-[var(--fg)]">
                USDT Deposit Address ({method === "USDT_BEP20" ? "BNB Smart Chain" : "TRON"})
              </span>
            </div>
            <span className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold px-2 py-0.5 text-[10px]">
              {method === "USDT_BEP20" ? "BEP20" : "TRC20"}
            </span>
          </div>

          {/* Crypto Address Box */}
          {(() => {
            const address =
              method === "USDT_BEP20"
                ? paymentAccounts?.usdtBep20Address
                : paymentAccounts?.usdtTrc20Address;
            return address ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold text-[var(--fg-muted)] block">
                    Your Deposit Address ({method === "USDT_BEP20" ? "BSC" : "TRON"})
                  </span>
                  <span className="font-mono text-xs text-[var(--fg)] break-all select-all font-semibold">
                    {address}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(address, "crypto")}
                  className={`shrink-0 inline-flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    copiedField === "crypto"
                      ? "bg-emerald-600 text-white"
                      : "bg-[var(--surface-2)] text-[var(--fg)] hover:bg-[var(--surface-3,var(--surface-2))] border border-[var(--border)]"
                  }`}
                >
                  {copiedField === "crypto" ? "✓ Copied!" : "📋 Copy Address"}
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-[11px] text-amber-700 dark:text-amber-300">
                ⚠️ Store USDT address will be configured in Admin Settings.
              </div>
            );
          })()}

          <p className="text-[11px] text-amber-700 dark:text-amber-300">
            ⚠️ Send only USDT on the <strong>{method === "USDT_BEP20" ? "BNB Smart Chain (BEP20)" : "TRON (TRC20)"}</strong> network. Sending on other networks may cause permanent loss.
          </p>
        </div>
      )}

      {/* Proof Submission: TxHash for Crypto OR Screenshot Upload for Bank */}
      {isCrypto ? (
        <div>
          <label htmlFor="txHash" className="block text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
            {t("txHash")} (Transaction ID / Hash)
          </label>
          <input
            id="txHash"
            name="txHash"
            required
            maxLength={120}
            placeholder="e.g. 0x3a4b5c... or e8f1a2..."
            className={FIELD}
          />
          <p className="mt-1 text-xs text-[var(--fg-muted)]">{t("txHashHint")}</p>
        </div>
      ) : (
        /* Screenshot Upload Dropzone */
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1">
            Payment Proof (Receipt Screenshot)
          </label>

          {previewUrl ? (
            <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 flex items-center gap-4">
              <img
                src={previewUrl}
                alt="Receipt preview"
                className="h-16 w-16 object-cover rounded-xl border border-[var(--border)] shadow-xs"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--fg)] truncate">{fileName}</p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  {uploading ? "⏳ Uploading..." : "✓ Receipt attached"}
                </p>
              </div>
              <button
                type="button"
                onClick={removeReceipt}
                className="text-xs text-rose-500 hover:text-rose-600 font-semibold px-2 py-1 rounded-lg border border-rose-500/20 hover:bg-rose-500/10"
              >
                ✕ Remove
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-2)]/60 p-6 text-center hover:border-[var(--accent)] hover:bg-[var(--surface-2)] transition-all"
            >
              <div className="text-2xl mb-1">📸</div>
              <p className="text-xs font-bold text-[var(--fg)]">
                Click or tap to upload transfer screenshot
              </p>
              <p className="text-[11px] text-[var(--fg-muted)] mt-0.5">
                Supports JPG, PNG, WEBP from your phone camera or gallery (Max 5MB)
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {uploadError && (
            <p className="mt-1.5 text-xs text-rose-600 font-semibold">{uploadError}</p>
          )}
        </div>
      )}

      {errorKey && (
        <p
          role="alert"
          className="rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {t(errorKey)}
        </p>
      )}

      <button
        disabled={pending || uploading || (!isCrypto && !uploadedUrl)}
        className="btn-shine mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold tracking-tight text-[var(--accent-fg)] shadow-sm transition-all duration-300 ease-[var(--ease-premium)] hover:bg-[var(--accent-hover)] hover:shadow-md active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "Submitting Deposit..." : uploading ? "Uploading Receipt..." : t("submit")}
      </button>
    </form>
  );
}
