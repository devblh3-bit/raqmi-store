"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { submitDeposit, type DepositState } from "@/app/actions/deposit";
import type { Locale } from "@/i18n";

const ERROR_KEY: Record<string, string> = {
  BAD_AMOUNT: "errorAmount",
  BAD_REQUEST: "errorGeneric",
  UNAUTHENTICATED: "errorGeneric",
  UNKNOWN: "errorGeneric",
};

const FIELD =
  "mt-2 h-11 w-full rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-5 text-sm outline-none focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--ring)]";

export default function DepositForm({ locale }: { locale: Locale }) {
  const t = useTranslations("wallet");
  const [method, setMethod] = useState("USDT_BEP20");
  const [state, action, pending] = useActionState<DepositState, FormData>(submitDeposit, {});

  const isCrypto = method !== "MANUAL_BANK";
  const errorKey = state.error ? (ERROR_KEY[state.error] ?? "errorGeneric") : null;

  if (state.ok) {
    return (
      <p className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
        {t("submitted")}
      </p>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="locale" value={locale} />

      <label htmlFor="amount" className="block text-sm font-semibold">
        {t("amount")}
      </label>
      <input
        id="amount"
        name="amount"
        type="number"
        step="0.01"
        min="1"
        max="1000000"
        required
        placeholder="25.00"
        className={FIELD}
      />

      <label htmlFor="method" className="mt-4 block text-sm font-semibold">
        {t("method")}
      </label>
      <select
        id="method"
        name="method"
        value={method}
        onChange={(e) => setMethod(e.target.value)}
        className={FIELD}
      >
        <option value="USDT_BEP20">{t("methodUsdtBep20")}</option>
        <option value="USDT_TRC20">{t("methodUsdtTrc20")}</option>
        <option value="MANUAL_BANK">{t("methodBank")}</option>
      </select>

      {isCrypto ? (
        <>
          <label htmlFor="txHash" className="mt-4 block text-sm font-semibold">
            {t("txHash")}
          </label>
          <input id="txHash" name="txHash" maxLength={120} placeholder="0x…" className={FIELD} />
          <p className="mt-1 px-5 text-xs text-[var(--fg-faint)]">{t("txHashHint")}</p>
        </>
      ) : (
        <>
          <label htmlFor="proofUrl" className="mt-4 block text-sm font-semibold">
            {t("proofUrl")}
          </label>
          <input
            id="proofUrl"
            name="proofUrl"
            type="url"
            maxLength={500}
            placeholder="https://…"
            className={FIELD}
          />
          <p className="mt-1 px-5 text-xs text-[var(--fg-faint)]">{t("proofUrlHint")}</p>
        </>
      )}

      {errorKey && (
        <p
          role="alert"
          className="mt-4 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {t(errorKey)}
        </p>
      )}

      <button
        disabled={pending}
        className="btn-shine mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold tracking-tight text-[var(--accent-fg)] shadow-sm transition-all duration-300 ease-[var(--ease-premium)] hover:bg-[var(--accent-hover)] hover:shadow-md active:scale-[0.98] disabled:opacity-60"
      >
        {t("submit")}
      </button>
    </form>
  );
}
