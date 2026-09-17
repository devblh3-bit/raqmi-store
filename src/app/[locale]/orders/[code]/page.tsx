import { notFound } from "next/navigation";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { normalizeOrderCode } from "@/lib/order-code";
import { Price } from "@/components/Price";
import type { Locale } from "@/i18n";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "checkout" });
  const loc = locale as Locale;

  const normalized = normalizeOrderCode(code);
  if (!normalized) notFound();

  // Own orders only. An order code is a bearer secret elsewhere (Track Order),
  // but this page is the signed-in view, so scope the query by userId and 404
  // rather than 403 — a wrong guess must not confirm the code exists.
  const session = await getSession();
  if (!session) notFound();

  const order = await prisma.order.findFirst({
    where: { code: normalized, userId: session.userId },
    include: { items: { include: { offer: { include: { product: true } } } } },
  });
  if (!order) notFound();

  const label = (o: (typeof order.items)[number]) =>
    loc === "ar" ? o.offer.labelAr : loc === "fr" ? o.offer.labelFr : o.offer.labelEn;
  const name = (o: (typeof order.items)[number]) =>
    loc === "ar"
      ? o.offer.product.nameAr
      : loc === "fr"
        ? o.offer.product.nameFr
        : o.offer.product.nameEn;

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)] sm:p-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
          {t("orderPlaced")}
        </span>

        <h1 className="mt-4 text-2xl font-bold tracking-tight">{t("orderCode")}</h1>
        <p className="mt-1 select-all font-mono text-lg font-semibold tracking-tight">
          {order.code}
        </p>

        <dl className="mt-6 flex flex-col gap-2 border-t border-[var(--border)] pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--fg-muted)]">{t("status")}</dt>
            <dd className="font-semibold">{order.status}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--fg-muted)]">{t("total")}</dt>
            <dd className="font-semibold">
              <Price cents={Number(order.totalMinor)} locale={loc} size="sm" />
            </dd>
          </div>
        </dl>

        <ul className="mt-6 flex flex-col gap-2 border-t border-[var(--border)] pt-4">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-2)] px-4 py-3"
            >
              <span className="text-sm">
                <span className="font-semibold">{name(item)}</span>
                <span className="text-[var(--fg-muted)]"> · {label(item)}</span>
                {item.quantity > 1 && (
                  <span className="text-[var(--fg-muted)]"> × {item.quantity}</span>
                )}
              </span>
              <span className="text-sm font-semibold">
                <Price cents={Number(item.unitPriceMinor)} locale={loc} size="sm" />
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-xs leading-5 text-[var(--fg-faint)]">
          Delivery is pending provider fulfillment. Track this code any time at{" "}
          <Link href={`/${locale}/track-order`} className="font-semibold text-[var(--accent)] hover:underline">
            Track Order
          </Link>
          .
        </p>

        <Link
          href={`/${locale}/products`}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm font-semibold shadow-sm transition-all hover:shadow-md"
        >
          {t("backToProducts")}
        </Link>
      </div>
    </div>
  );
}
