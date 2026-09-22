import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import DepositForm from "@/components/DepositForm";
import { Price } from "@/components/Price";
import { getSystemSettings } from "@/lib/settings";
import type { Locale } from "@/i18n";

export default async function ResellerWalletPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "wallet" });
  const loc = locale as Locale;

  const session = await getSession();
  if (!session) redirect(`/${locale}/login?next=/${locale}/reseller/wallet`);
  if (session.role !== "RESELLER") redirect(`/${locale}/wallet`);

  const [wallet, deposits, settings] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: session.userId } }),
    prisma.deposit.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    getSystemSettings(),
  ]);

  const balanceMinor = Number(wallet?.balanceMinor ?? 0n);

  return (
    <div className="flex flex-col gap-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-2 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)] sm:p-8">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            💳 Wholesale Balance
          </span>
          <span className="text-xs font-medium text-[var(--fg-muted)]">
            Conversion: 1 USD = {settings.dzdRate} DZD
          </span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--fg)]">
          Reseller Wallet & Instant Top-up
        </h1>
        <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
          Maintain sufficient pre-funded balance for zero-latency, 1-click order fulfillment.
        </p>

        <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-6">
          <p className="text-xs font-semibold text-[var(--fg-muted)]">Available Balance</p>
          <div className="mt-1 text-3xl font-black tracking-tight text-[var(--fg)]">
            <Price cents={balanceMinor} locale={loc} size="lg" />
          </div>
        </div>
      </div>

      {/* Add Funds Section */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)] sm:p-8">
        <h2 className="text-base font-bold text-[var(--fg)]">{t("addFunds")}</h2>
        <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
          Submit deposit via CCP, BaridiMob, or Crypto. Deposits are confirmed by administrators.
        </p>
        <div className="mt-5">
          <DepositForm
            locale={loc}
            paymentAccounts={{
              baridimobRip: settings.baridimobRip,
              baridimobHolder: settings.baridimobHolder,
              ccpAccount: settings.ccpAccount,
              usdtBep20Address: settings.usdtBep20Address,
              usdtTrc20Address: settings.usdtTrc20Address,
              dzdRate: settings.dzdRate,
            }}
          />
        </div>
      </div>

      {/* Deposit History Section */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)] sm:p-8">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div>
            <h2 className="text-base font-bold text-[var(--fg)]">{t("history")}</h2>
            <p className="mt-0.5 text-xs text-[var(--fg-muted)]">Recent wallet top-up transactions</p>
          </div>
          <span className="text-xs font-semibold text-[var(--fg-faint)]">
            {deposits.length} Records
          </span>
        </div>

        {deposits.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--fg-muted)]">{t("noDeposits")}</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2.5">
            {deposits.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm"
              >
                <div>
                  <span className="font-bold text-[var(--fg)]">
                    <Price cents={Number(d.amountMinor)} locale={loc} size="sm" />
                  </span>
                  <span className="block text-[11px] text-[var(--fg-muted)]">
                    {new Date(d.createdAt).toLocaleDateString(loc, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    d.status === "APPROVED"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : d.status === "REJECTED"
                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {t(`status${d.status}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

