import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { normalizeOrderCode } from "@/lib/order-code";
import { Price } from "@/components/Price";
import { ClearCartAfterCheckout } from "@/components/ClearCartAfterCheckout";
import { CopyButton } from "@/components/CopyButton";
import { tryDecryptField } from "@/lib/crypto";
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

  // Allow the authenticated owner OR an admin to inspect the order.
  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/orders/${normalized}`)}`);
  }

  const order = await prisma.order.findFirst({
    where:
      session.role === "ADMIN"
        ? { code: normalized }
        : { code: normalized, userId: session.userId },
    include: {
      items: {
        include: {
          offer: { include: { product: true } },
          providerOrders: {
            where: { deliveryAvailable: true },
            select: { id: true, clientOrderId: true, deliveryEnc: true },
          },
        },
      },
    },
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

  // Decrypt delivered assets for all items
  const decryptedItems = order.items.map((item) => {
    let manualDelivery: string | null = null;
    if (item.deliveryPayloadEnc) {
      const dec = tryDecryptField({
        recordId: item.id,
        fieldName: "deliveryPayloadEnc",
        payload: item.deliveryPayloadEnc,
      });
      if (dec.ok) manualDelivery = dec.value;
    }

    const providerAccounts: Array<{
      login?: string;
      password?: string;
      extra?: Record<string, string>;
      raw?: unknown;
    }> = [];

    for (const po of item.providerOrders) {
      if (po.deliveryEnc) {
        const providerOfferId = po.clientOrderId.replace(`oi_${item.id}_`, "");
        const dec = tryDecryptField({
          recordId: `${item.id}:${providerOfferId}`,
          fieldName: "delivery",
          payload: po.deliveryEnc,
        });
        if (dec.ok) {
          try {
            const parsed = JSON.parse(dec.value);
            if (Array.isArray(parsed?.accounts)) {
              providerAccounts.push(...parsed.accounts);
            }
          } catch {}
        }
      }
    }

    let customerInput: string | null = null;
    if (item.customerInputEnc) {
      const dec = tryDecryptField({
        recordId: item.id,
        fieldName: "customerInput",
        payload: item.customerInputEnc,
      });
      if (dec.ok) customerInput = dec.value;
    }

    return {
      ...item,
      manualDelivery,
      providerAccounts,
      customerInput,
      hasDelivery: Boolean(manualDelivery || providerAccounts.length > 0),
    };
  });

  const hasAnyDelivery = decryptedItems.some((i) => i.hasDelivery);
  const isPendingProcurement = decryptedItems.some(
    (i) => i.status === "AWAITING_FULFILLMENT" || i.status === "PLACED",
  );

  return (
    <>
      <ClearCartAfterCheckout />
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--elev-1)] sm:p-8">
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                order.status === "COMPLETED"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  order.status === "COMPLETED" ? "bg-emerald-500" : "bg-amber-500"
                }`}
                aria-hidden
              />
              {order.status === "COMPLETED"
                ? loc === "ar"
                  ? "تم التسليم بنجاح"
                  : loc === "fr"
                    ? "Commande livrée"
                    : "Delivered & Ready"
                : t("orderPlaced")}
            </span>

            <span className="text-xs font-mono font-medium text-[var(--fg-muted)]">
              {order.createdAt.toLocaleDateString(loc)}
            </span>
          </div>

          <h1 className="mt-4 text-2xl font-bold tracking-tight">{t("orderCode")}</h1>
          <p className="mt-1 select-all font-mono text-lg font-semibold tracking-tight text-[var(--accent)]">
            {order.code}
          </p>

          <dl className="mt-6 flex flex-col gap-2 border-t border-[var(--border)] pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--fg-muted)]">{t("status")}</dt>
              <dd className="font-semibold uppercase tracking-wider text-xs">
                {order.status}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--fg-muted)]">{t("total")}</dt>
              <dd className="font-semibold">
                <Price cents={Number(order.totalMinor)} locale={loc} size="sm" />
              </dd>
            </div>
          </dl>

          {/* DELIVERED DIGITAL ASSETS / CREDENTIALS CARD */}
          {hasAnyDelivery && (
            <div className="mt-6 rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                    ✓
                  </span>
                  <h2 className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
                    {loc === "ar"
                      ? "بيانات التفعيل والمنتج الرقمي"
                      : loc === "fr"
                        ? "Vos identifiants & Accès livrés"
                        : "Your Digital Product & Credentials"}
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-200">
                  ⚡ {loc === "ar" ? "جاهز للاستخدام" : loc === "fr" ? "Actif" : "Ready to use"}
                </span>
              </div>

              <div className="mt-4 space-y-4">
                {decryptedItems
                  .filter((i) => i.hasDelivery)
                  .map((item) => (
                    <div key={item.id} className="space-y-3">
                      <div className="text-xs font-bold text-[var(--fg)] flex items-center justify-between">
                        <span>
                          {name(item)} · {label(item)}
                        </span>
                      </div>

                      {/* Manual delivery text payload (license key / login / token) */}
                      {item.manualDelivery && (
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-xs">
                          <div className="flex items-center justify-between pb-2 text-[11px] font-semibold text-[var(--fg-muted)] border-b border-[var(--border)]/40">
                            <span>
                              {loc === "ar"
                                ? "بيانات الدخول والمفتاح"
                                : loc === "fr"
                                  ? "Identifiants / Clé"
                                  : "License Key / Login"}
                            </span>
                            <CopyButton
                              text={item.manualDelivery}
                              label={loc === "ar" ? "نسخ" : loc === "fr" ? "Copier" : "Copy"}
                            />
                          </div>
                          <div className="mt-2.5 select-all font-mono text-xs text-[var(--fg)] leading-relaxed break-all whitespace-pre-wrap bg-[var(--surface-2)]/60 rounded-xl p-3 border border-[var(--border)]/60">
                            {item.manualDelivery}
                          </div>
                        </div>
                      )}

                      {/* Automated provider structured accounts */}
                      {item.providerAccounts.map((acc, aIdx) => (
                        <div
                          key={aIdx}
                          className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-xs"
                        >
                          {acc.login && (
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                                  Login / Email
                                </span>
                                <span className="block select-all font-mono text-xs font-bold text-[var(--fg)] break-all">
                                  {acc.login}
                                </span>
                              </div>
                              <CopyButton text={acc.login} />
                            </div>
                          )}

                          {acc.password && (
                            <div className="flex items-center justify-between gap-2 border-t border-[var(--border)]/40 pt-2">
                              <div className="min-w-0">
                                <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                                  Password
                                </span>
                                <span className="block select-all font-mono text-xs font-bold text-[var(--fg)] break-all">
                                  {acc.password}
                                </span>
                              </div>
                              <CopyButton text={acc.password} />
                            </div>
                          )}

                          {acc.extra &&
                            Object.entries(acc.extra).map(([k, v]) => (
                              <div
                                key={k}
                                className="flex items-center justify-between gap-2 border-t border-[var(--border)]/40 pt-2"
                              >
                                <div className="min-w-0">
                                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                                    {k}
                                  </span>
                                  <span className="block select-all font-mono text-xs text-[var(--fg)] break-all">
                                    {v}
                                  </span>
                                </div>
                                <CopyButton text={v} />
                              </div>
                            ))}
                        </div>
                      ))}

                      {item.customerInput && (
                        <p className="text-[11px] text-[var(--fg-muted)]">
                          🎯 {loc === "ar" ? "تم التفعيل على:" : loc === "fr" ? "Activé sur :" : "Activated on:"}{" "}
                          <span className="font-mono font-bold text-[var(--fg)]">
                            {item.customerInput}
                          </span>
                        </p>
                      )}
                    </div>
                  ))}
              </div>

              <p className="mt-3.5 text-[11px] leading-relaxed text-[var(--fg-muted)] border-t border-emerald-500/20 pt-2.5">
                {loc === "ar"
                  ? "💡 يُرجى حفظ بياناتك. في حال واجهت أي استفسار، دعم راقمي متوفر لخدمتك."
                  : loc === "fr"
                    ? "💡 Veuillez sauvegarder vos identifiants. Si vous avez besoin d'aide, notre support est à votre disposition."
                    : "💡 Please save your credentials securely. If you need any assistance, Raqmi support is here to help."}
              </p>
            </div>
          )}

          {/* PROCESSING NOTICE WHEN STILL AWAITING DISPATCH */}
          {!hasAnyDelivery && isPendingProcurement && (
            <div className="mt-6 rounded-3xl border border-blue-500/30 bg-blue-500/5 p-5 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-800 dark:text-blue-300">
                <span className="animate-spin text-sm">⏳</span>
                <span>
                  {loc === "ar"
                    ? "جاري التجهيز والتفعيل الفوري"
                    : loc === "fr"
                      ? "Traitement & activation en cours"
                      : "Processing & Activation in Progress"}
                </span>
              </div>
              <p className="text-xs text-[var(--fg-muted)] leading-relaxed">
                {loc === "ar"
                  ? "تم تأكيد طلبك وجاري تفعيله لدى المزود. ستظهر بيانات التفعيل والمفاتيح في هذه الصفحة تلقائياً فور اكتمالها."
                  : loc === "fr"
                    ? "Votre commande est confirmée et en cours d'activation chez le fournisseur. Vos identifiants apparaîtront directement ici."
                    : "Your order is confirmed and being activated with our supplier. Your access credentials will appear right here once ready."}
              </p>
            </div>
          )}

          {/* ORDER ITEMS LIST */}
          <ul className="mt-6 flex flex-col gap-2 border-t border-[var(--border)] pt-4">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-1.5 rounded-2xl bg-[var(--surface-2)] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
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
                </div>
                {item.agencyFeeMinor != null && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--fg-muted)] border-t border-[var(--border)]/40 pt-1.5 mt-0.5">
                    <span>
                      {t("baseCost")}:{" "}
                      <Price
                        cents={Number(item.procurementCostUsdMinor ?? 0n)}
                        locale={loc}
                        size="sm"
                      />
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      {t("agencyFee")}:{" "}
                      <Price cents={Number(item.agencyFeeMinor)} locale={loc} size="sm" />
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {order.guestEmail && (
            <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
              <div className="flex items-center gap-2 font-bold text-xs text-blue-800 dark:text-blue-300">
                <span aria-hidden>📧</span>
                <span>{t("accessNoticeTitle")}</span>
              </div>
              <p className="mt-1.5 text-xs text-[var(--fg-muted)] leading-relaxed">
                {t("accessNoticeBody")}
              </p>
              <p className="mt-1 font-mono text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                {order.guestEmail}
              </p>
            </div>
          )}

          <p className="mt-6 text-xs leading-5 text-[var(--fg-faint)]">
            {loc === "ar"
              ? "يتم تنفيذ هذا الطلب عبر الوكالة والتوريد الفوري المعتمد وفق "
              : loc === "fr"
                ? "Cette commande est traitée sous contrat de mandat d'approvisionnement selon "
                : "This order is fulfilled under automated agency procurement according to "}
            <Link
              href={`/${locale}/terms`}
              className="font-semibold text-[var(--accent)] hover:underline"
            >
              {t("termsLink")}
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
    </>
  );
}
