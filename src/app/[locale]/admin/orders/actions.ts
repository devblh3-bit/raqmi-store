"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { Prisma } from "@prisma/client";
import {
  retryOrderItemSchema,
  manualFulfillItemSchema,
  refundOrderItemSchema,
  refundOrderSchema,
} from "@/lib/admin/validation";
import { encryptField } from "@/lib/crypto";
import { dispatchPendingOrders } from "@/lib/fulfillment";
import { creditWalletTx, isSerializationConflict, MAX_TXN_ATTEMPTS } from "@/lib/wallet";

function adminError(msg: string) {
  return { error: msg } as const;
}

/**
 * Re-dispatches an order item that failed or stalled.
 */
export async function retryOrderItem(formData: FormData) {
  const session = await requireAdmin();
  const parsed = retryOrderItemSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return adminError("BAD_REQUEST");

  const { orderItemId } = parsed.data;

  const item = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: { order: true },
  });

  if (!item) return adminError("NOT_FOUND");
  if (item.status === "COMPLETED" || item.status === "REFUNDED") {
    return adminError("ITEM_ALREADY_TERMINAL");
  }

  // Reset item to AWAITING_FULFILLMENT and reset attempt count so fulfillment claims it
  await prisma.orderItem.update({
    where: { id: orderItemId },
    data: {
      status: "AWAITING_FULFILLMENT",
      attemptCount: 0,
    },
  });

  // If order was marked FAILED, revert to PAID so dispatch worker can process
  if (item.order.status === "FAILED") {
    await prisma.order.update({
      where: { id: item.orderId },
      data: { status: "PAID" },
    });
  }

  // Clear any active lease on provider order
  await prisma.providerOrder.updateMany({
    where: { orderItemId },
    data: { leaseUntil: null },
  });

  // Trigger dispatch immediately for this item
  const outcomes = await dispatchPendingOrders(1, { onlyItemIds: [orderItemId] });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "ORDER_ITEM_RETRY_DISPATCH",
      entity: "OrderItem",
      entityId: orderItemId,
      detail: {
        orderId: item.orderId,
        orderCode: item.order.code,
        outcomes,
      } as never,
    },
  });

  revalidatePath("/admin/orders");
  return { ok: true as const, outcomes };
}

/**
 * Delivers credentials / keys manually entered by the admin,
 * encrypts the payload with AES-256-GCM, and marks the item COMPLETED.
 */
export async function manualFulfillItem(formData: FormData) {
  const session = await requireAdmin();
  const parsed = manualFulfillItemSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return adminError("BAD_REQUEST");

  const { orderItemId, payload } = parsed.data;

  const item = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: {
      order: { include: { items: true } },
      attempts: { orderBy: { attemptedAt: "desc" }, take: 1 },
      offer: {
        include: {
          links: { orderBy: { priority: "asc" }, take: 1 },
        },
      },
    },
  });

  if (!item) return adminError("NOT_FOUND");
  if (item.status === "COMPLETED") return adminError("ALREADY_COMPLETED");
  if (item.status === "REFUNDED") return adminError("CANNOT_FULFILL_REFUNDED");

  const deliveryPayloadEnc = encryptField({
    recordId: orderItemId,
    fieldName: "deliveryPayloadEnc",
    plaintext: payload,
  });

  await prisma.$transaction(async (tx) => {
    await tx.orderItem.update({
      where: { id: orderItemId },
      data: {
        status: "COMPLETED",
        deliveryPayloadEnc,
      },
    });

    await tx.providerOrder.updateMany({
      where: { orderItemId },
      data: {
        status: "COMPLETED",
        deliveryAvailable: true,
      },
    });

    const providerOfferId = item.attempts[0]?.providerOfferId ?? item.offer.links[0]?.providerOfferId;
    if (providerOfferId) {
      await tx.fulfillmentAttempt.create({
        data: {
          orderItemId,
          providerOfferId,
          status: "SUCCEEDED",
          errorCode: "MANUAL_FULFILLMENT",
        },
      });
    }

    const otherItems = item.order.items.filter((i) => i.id !== orderItemId);
    const allCompleted = otherItems.every((i) => i.status === "COMPLETED");
    const nextOrderStatus = allCompleted ? "COMPLETED" : "PARTIALLY_DELIVERED";

    await tx.order.update({
      where: { id: item.orderId },
      data: { status: nextOrderStatus },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: "ORDER_ITEM_MANUAL_FULFILL",
        entity: "OrderItem",
        entityId: orderItemId,
        detail: {
          orderId: item.orderId,
          orderCode: item.order.code,
          previousStatus: item.status,
          nextOrderStatus,
        } as never,
      },
    });
  });

  revalidatePath("/admin/orders");
  return { ok: true as const };
}

/**
 * 1-Click refund of a specific order item back to the customer's wallet.
 */
export async function refundOrderItem(formData: FormData) {
  const session = await requireAdmin();
  const parsed = refundOrderItemSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return adminError("BAD_REQUEST");

  const { orderItemId, reason } = parsed.data;

  const item = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: {
      order: { include: { items: true } },
    },
  });

  if (!item) return adminError("NOT_FOUND");
  if (item.status === "REFUNDED") return adminError("ALREADY_REFUNDED");
  if (!item.order.userId) return adminError("GUEST_ORDER_CANNOT_REFUND_WALLET");

  const refundMinor = item.unitPriceMinor * BigInt(item.quantity);

  for (let attempt = 1; ; attempt++) {
    try {
      await prisma.$transaction(
        async (tx) => {
          await creditWalletTx(tx, {
            userId: item.order.userId!,
            amountMinor: refundMinor,
            type: "REFUND",
            reference: item.order.code,
            note: reason || `Admin refund for item in order ${item.order.code}`,
          });

          await tx.orderItem.update({
            where: { id: orderItemId },
            data: { status: "REFUNDED" },
          });

          const otherItems = item.order.items.filter((i) => i.id !== orderItemId);
          const allRefunded = otherItems.every((i) => i.status === "REFUNDED");
          const someCompleted = otherItems.some((i) => i.status === "COMPLETED");

          let nextOrderStatus = item.order.status;
          let nextPaymentStatus = item.order.paymentStatus;
          if (allRefunded) {
            nextOrderStatus = "REFUNDED";
            nextPaymentStatus = "REFUNDED";
          } else if (someCompleted) {
            nextOrderStatus = "PARTIALLY_DELIVERED";
          }

          await tx.order.update({
            where: { id: item.orderId },
            data: {
              status: nextOrderStatus,
              paymentStatus: nextPaymentStatus,
            },
          });

          await tx.auditLog.create({
            data: {
              actorId: session.userId,
              action: "ORDER_ITEM_REFUNDED",
              entity: "OrderItem",
              entityId: orderItemId,
              detail: {
                orderId: item.orderId,
                orderCode: item.order.code,
                amountMinor: refundMinor.toString(),
                reason: reason || "Admin item refund",
              } as never,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      break;
    } catch (e) {
      if (attempt < MAX_TXN_ATTEMPTS && isSerializationConflict(e)) continue;
      throw e;
    }
  }

  revalidatePath("/admin/orders");
  return { ok: true as const, amountMinor: refundMinor.toString() };
}

/**
 * 1-Click refund of all remaining non-refunded items in an order back to wallet.
 */
export async function refundOrder(formData: FormData) {
  const session = await requireAdmin();
  const parsed = refundOrderSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return adminError("BAD_REQUEST");

  const { orderId, reason } = parsed.data;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) return adminError("NOT_FOUND");
  if (order.status === "REFUNDED") return adminError("ALREADY_REFUNDED");
  if (!order.userId) return adminError("GUEST_ORDER_CANNOT_REFUND_WALLET");

  const activeItems = order.items.filter((i) => i.status !== "REFUNDED");
  if (!activeItems.length) return adminError("NO_ACTIVE_ITEMS_TO_REFUND");

  const totalRefundMinor = activeItems.reduce(
    (acc, it) => acc + it.unitPriceMinor * BigInt(it.quantity),
    0n,
  );

  for (let attempt = 1; ; attempt++) {
    try {
      await prisma.$transaction(
        async (tx) => {
          await creditWalletTx(tx, {
            userId: order.userId!,
            amountMinor: totalRefundMinor,
            type: "REFUND",
            reference: order.code,
            note: reason || `Admin full refund for order ${order.code}`,
          });

          await tx.orderItem.updateMany({
            where: { orderId, status: { not: "REFUNDED" } },
            data: { status: "REFUNDED" },
          });

          await tx.order.update({
            where: { id: orderId },
            data: {
              status: "REFUNDED",
              paymentStatus: "REFUNDED",
            },
          });

          await tx.auditLog.create({
            data: {
              actorId: session.userId,
              action: "ORDER_REFUNDED",
              entity: "Order",
              entityId: orderId,
              detail: {
                orderCode: order.code,
                amountMinor: totalRefundMinor.toString(),
                itemsRefundedCount: activeItems.length,
                reason: reason || "Admin full order refund",
              } as never,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      break;
    } catch (e) {
      if (attempt < MAX_TXN_ATTEMPTS && isSerializationConflict(e)) continue;
      throw e;
    }
  }

  revalidatePath("/admin/orders");
  return { ok: true as const, amountMinor: totalRefundMinor.toString() };
}
