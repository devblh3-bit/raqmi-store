import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getResellerRateSheet } from "@/lib/reseller";
import { getSystemSettings } from "@/lib/settings";
import { RateSheetExplorer } from "./rate-sheet-explorer";
import type { Locale } from "@/i18n";

export default async function ResellerRatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = locale as Locale;

  const session = await getSession();
  if (!session) redirect(`/${locale}/login?next=/${locale}/reseller/rates`);
  if (session.role !== "RESELLER") redirect(`/${locale}/account`);

  const [user, settings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        tier: { select: { id: true, name: true, discountPercent: true } },
      },
    }),
    getSystemSettings(),
  ]);

  if (!user?.tier) {
    redirect(`/${locale}/reseller`);
  }

  const rateSheet = await getResellerRateSheet(user.tier.id);

  return (
    <RateSheetExplorer
      locale={loc}
      tierName={user.tier.name}
      discountPercent={Number(user.tier.discountPercent)}
      rateSheet={rateSheet}
      dzdRate={settings.dzdRate}
    />
  );
}

