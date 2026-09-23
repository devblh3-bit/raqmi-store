import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { tryDecryptField } from "@/lib/crypto";
import {
  OrderManager,
  type SerializedOrder,
  type SerializedOrderItem,
  type SerializedAccountDelivery,
} from "./order-manager";

export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale);
  const { status } = await searchParams;

  const valid: readonly OrderStatus[] = [
    "PENDING",
    "PAID",
    "PLACED_WITH_PROVIDER",
    "COMPLETED",
    "PARTIALLY_DELIVERED",
    "FAILED",
    "REFUNDED",
  ];

  const where: Prisma.OrderWhereInput =
    status && (valid as readonly string[]).includes(status)
      ? status === "FAILED"
        ? {
            OR: [
              { status: "FAILED" },
              { items: { some: { status: "FAILED" } } },
              { items: { some: { attemptCount: { gte: 5 } } } },
            ],
          }
        : { status: status as OrderStatus }
      : {};

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { id: true, email: true } },
      items: {
        include: {
          offer: { select: { labelEn: true, labelAr: true, labelFr: true } },
          attempts: {
            orderBy: { attemptedAt: "desc" },
            include: {
              providerOffer: {
                select: {
                  providerSku: true,
                  provider: { select: { code: true } },
                },
              },
            },
          },
          providerOrders: {
            orderBy: { createdAt: "desc" },
            include: {
              provider: { select: { code: true } },
            },
          },
        },
      },
    },
  });

  const serializedOrders: SerializedOrder[] = orders.map((o) => {
    const items: SerializedOrderItem[] = o.items.map((it) => {
      // 1. Decrypt Customer Input
      let customerInput: string | null = null;
      let customerInputDecrypted = false;
      if (it.customerInputEnc) {
        const res = tryDecryptField({
          recordId: it.id,
          fieldName: "customerInput",
          payload: it.customerInputEnc,
        });
        if (res.ok) {
          customerInput = res.value;
          customerInputDecrypted = true;
        } else {
          customerInput = "[Decryption Failed]";
        }
      }

      // 2. Decrypt Manual Delivery Payload
      let manualDeliveryPayload: string | null = null;
      if (it.deliveryPayloadEnc) {
        const res = tryDecryptField({
          recordId: it.id,
          fieldName: "deliveryPayloadEnc",
          payload: it.deliveryPayloadEnc,
        });
        if (res.ok) {
          manualDeliveryPayload = res.value;
        } else {
          manualDeliveryPayload = "[Decryption Failed]";
        }
      }

      // 3. Decrypt Provider Accounts
      let providerAccounts: SerializedAccountDelivery[] | null = null;
      for (const po of it.providerOrders) {
        if (po.deliveryEnc) {
          const providerOfferId = po.clientOrderId.replace(`oi_${it.id}_`, "");
          const res = tryDecryptField({
            recordId: `${it.id}:${providerOfferId}`,
            fieldName: "delivery",
            payload: po.deliveryEnc,
          });
          if (res.ok) {
            try {
              const parsed = JSON.parse(res.value);
              if (Array.isArray(parsed?.accounts)) {
                providerAccounts = (providerAccounts ?? []).concat(parsed.accounts);
              }
            } catch {
              // Ignore non-json delivery payload
            }
          }
        }
      }

      return {
        id: it.id,
        offerId: it.offerId,
        offerLabelEn: it.offer.labelEn,
        offerLabelAr: it.offer.labelAr,
        offerLabelFr: it.offer.labelFr,
        quantity: it.quantity,
        unitPriceMinor: it.unitPriceMinor.toString(),
        unitCostMinor: it.unitCostMinor.toString(),
        costCurrency: it.costCurrency,
        requiresCustomerInput: it.requiresCustomerInput,
        customerInput,
        customerInputDecrypted,
        manualDeliveryPayload,
        providerAccounts,
        status: it.status,
        attemptCount: it.attemptCount,
        attempts: it.attempts.map((att) => ({
          id: att.id,
          providerOfferId: att.providerOfferId,
          providerCode: att.providerOffer.provider.code,
          providerSku: att.providerOffer.providerSku,
          status: att.status,
          errorCode: att.errorCode,
          attemptedAt: att.attemptedAt.toISOString(),
        })),
        providerOrders: it.providerOrders.map((po) => ({
          id: po.id,
          providerCode: po.provider.code,
          providerOrderId: po.providerOrderId,
          clientOrderId: po.clientOrderId,
          status: po.status,
          errorCode: po.errorCode,
          errorDetail: po.errorDetail,
          attempts: po.attempts,
          lastPolledAt: po.lastPolledAt?.toISOString() ?? null,
          nextPollAt: po.nextPollAt?.toISOString() ?? null,
        })),
      };
    });

    return {
      id: o.id,
      code: o.code,
      userId: o.userId,
      userEmail: o.user?.email ?? null,
      guestEmail: o.guestEmail,
      totalMinor: o.totalMinor.toString(),
      currency: o.currency,
      status: o.status,
      paymentStatus: o.paymentStatus,
      locale: o.locale,
      createdAt: o.createdAt.toISOString(),
      items,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Orders & Fulfillment</h1>
        <p className="text-sm text-[var(--fg-muted)] mt-1">
          Monitor incoming orders, inspect decrypted customer inputs & credentials, deliver manual keys, and execute 1-click wallet refunds.
        </p>
      </div>

      <OrderManager
        orders={serializedOrders}
        initialStatus={status && (valid as readonly string[]).includes(status) ? status : "ALL"}
      />
    </div>
  );
}
