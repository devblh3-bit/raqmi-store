import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { getResellerOrdersWithKeys } from "@/lib/reseller";
import { ResellerOrdersExplorer } from "./orders-explorer";
import type { Locale } from "@/i18n";

export default async function ResellerOrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = locale as Locale;

  const session = await getSession();
  if (!session) redirect(`/${locale}/login?next=/${locale}/reseller/orders`);
  if (session.role !== "RESELLER") redirect(`/${locale}/account`);

  const orders = await getResellerOrdersWithKeys(session.userId);

  return <ResellerOrdersExplorer locale={loc} orders={orders} />;
}

