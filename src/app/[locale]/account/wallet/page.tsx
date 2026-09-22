import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import DepositForm from "@/components/DepositForm";
import { Price } from "@/components/Price";
import { getSystemSettings } from "@/lib/settings";
import type { Locale } from "@/i18n";

export default async function AccountWalletPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ amount?: string; method?: string }>;
}) {
  const { locale } = await params;
  const { amount: initialAmount, method: initialMethod } = (await searchParams) ?? {};
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "wallet" });
  const loc = locale as Locale;

  const session = await getSession();
  if (!session) redirect(`/${locale}/login?next=/${locale}/account/wallet`);

  // Wallet row is created lazily on first credit, so absent == zero balance.
  const [wallet, deposits, settings] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: session.userId } }),
    prisma.deposit.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    getSystemSettings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-xs text-[var(--fg-muted)] mt-0.5">
          Manage your balance, add funds, and view recent deposit transactions.
        </p>
      </div>

      {/* Balance Card */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xs sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
          {t("balance")}
        </p>
        <div className="mt-2 text-3xl font-black tracking-tight">
          <Price cents={Number(wallet?.balanceMinor ?? 0n)} locale={loc} size="lg" />
        </div>
      </div>

      {/* Add Funds */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xs sm:p-8">
        <h2 className="text-base font-bold tracking-tight">{t("addFunds")}</h2>
        <div className="mt-4">
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
            initialAmount={initialAmount}
            initialMethod={initialMethod}
          />
        </div>
      </div>

      {/* Deposit History */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xs sm:p-8">
        <h2 className="text-base font-bold tracking-tight">{t("history")}</h2>
        {deposits.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--fg-muted)]">{t("noDeposits")}</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2.5">
            {deposits.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-2)] px-4 py-3 text-sm transition-colors hover:bg-[var(--surface-2)]/80"
              >
                <span className="font-semibold">
                  <Price cents={Number(d.amountMinor)} locale={loc} size="sm" />
                </span>
                <span className="rounded-full bg-[var(--surface)] px-2.5 py-0.5 text-xs font-semibold text-[var(--fg-muted)]">
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

