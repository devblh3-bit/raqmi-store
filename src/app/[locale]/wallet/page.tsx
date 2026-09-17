import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import DepositForm from "@/components/DepositForm";
import { Price } from "@/components/Price";
import type { Locale } from "@/i18n";

export default async function WalletPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "wallet" });
  const loc = locale as Locale;

  const session = await getSession();
  if (!session) redirect(`/${locale}/login?next=wallet`);

  // Wallet row is created lazily on first credit, so absent == zero balance.
  const [wallet, deposits] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: session.userId } }),
    prisma.deposit.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)] sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-4 text-sm text-[var(--fg-muted)]">{t("balance")}</p>
        <div className="mt-1 text-3xl font-black tracking-tight">
          <Price cents={Number(wallet?.balanceMinor ?? 0n)} locale={loc} size="lg" />
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)] sm:p-8">
        <h2 className="text-sm font-semibold">{t("addFunds")}</h2>
        <div className="mt-4">
          <DepositForm locale={loc} />
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)] sm:p-8">
        <h2 className="text-sm font-semibold">{t("history")}</h2>
        {deposits.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--fg-muted)]">{t("noDeposits")}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {deposits.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-2)] px-4 py-3 text-sm"
              >
                <span className="font-semibold">
                  <Price cents={Number(d.amountMinor)} locale={loc} size="sm" />
                </span>
                <span className="text-xs font-medium text-[var(--fg-muted)]">
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
