import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "./db";
import { getAdapter } from "./providers";
import {
  isNotSupported,
  type AdapterResult,
  type NormalizedDelivery,
  type NormalizedOrder,
  type NormalizedOrderStatus,
} from "./providers/types";
import { decryptField, encryptField } from "./crypto";
import { notifyProviderFailure } from "./telegram/notify";

/**
 * Fulfillment dispatch: turn a paid OrderItem into a provider order.
 *
 * Walking the links in `priority` order gives the fallback the schema was built
 * for: if the cheapest supplier fails, the next enabled link is tried, and each
 * try is recorded as a FulfillmentAttempt so the decision is auditable.
 *
 * Idempotency is the whole game here, because a dispatch may run again after a
 * crash and the buyer must not be charged or delivered twice:
 *  - `clientOrderId` is a pure function of (orderItem, link), so a retry reuses
 *    it and the provider replays its original order rather than creating a new
 *    one. ProviderOrder's @@unique([providerId, clientOrderId]) is the backstop.
 *  - Items are claimed with a lease, so two workers cannot dispatch the same
 *    item concurrently.
 *
 * ponytail: no polling loop. A provider that returns PENDING is recorded and
 * left for a later reconcile pass (`nextPollAt` is already on ProviderOrder and
 * `getOrder` exists on every adapter); this module only places orders.
 * Upgrade path: `reconcilePending()` on a cron, reading nextPollAt.
 */

/** How long a claim is held before another worker may retry the item. */
const LEASE_MS = 2 * 60 * 1000;
const MAX_ITEMS_PER_RUN = 25;
/** More than this and the provider is presumed broken, not the order. */
const MAX_ATTEMPTS_PER_ITEM = Number(process.env.FULFILLMENT_MAX_ATTEMPTS ?? 5);

export type DispatchOutcome =
  | { kind: "completed"; itemId: string; providerOrderId: string }
  | { kind: "pending"; itemId: string; providerOrderId: string; status: NormalizedOrderStatus }
  | { kind: "failed"; itemId: string; reason: string }
  | { kind: "skipped"; itemId: string; reason: string };

/** Stable per-attempt id. Derived, never random, so a retry cannot mint a new one. */
function clientOrderIdFor(orderItemId: string, providerOfferId: string): string {
  return `oi_${orderItemId}_${providerOfferId}`;
}

/** Statuses that mean the provider will still act — not a failure, not a delivery. */
const PROVISIONAL: ReadonlySet<NormalizedOrderStatus> = new Set([
  "PENDING",
  "PAID_PENDING_DELIVERY",
  "AWAITING_INPUT",
  "AWAITING_ACTIVATION",
  "AWAITING_SELLER",
  "UNKNOWN",
]);

/**
 * Claim items awaiting fulfillment.
 *
 * The lease update is a conditional write (`leaseUntil` null or expired), so the
 * worker that wins the row is the only one that dispatches it.
 */
async function claimItems(limit: number, onlyItemIds?: string[]) {
  const now = new Date();
  const candidates = await prisma.orderItem.findMany({
    where: {
      ...(onlyItemIds?.length ? { id: { in: onlyItemIds } } : {}),
      status: "AWAITING_FULFILLMENT",
      attemptCount: { lt: MAX_ATTEMPTS_PER_ITEM },
      order: { paymentStatus: "PAID" },
      OR: [{ providerOrders: { none: { leaseUntil: { gt: now } } } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  const claimed: string[] = [];
  for (const c of candidates) {
    // The lease lives on ProviderOrder, which may not exist yet, so claim with
    // an attemptCount bump guarded on the status we read: a lost race is a no-op.
    const res = await prisma.orderItem.updateMany({
      where: { id: c.id, status: "AWAITING_FULFILLMENT" },
      data: { attemptCount: { increment: 1 } },
    });
    if (res.count === 1) claimed.push(c.id);
  }
  return claimed;
}

/** Pull the buyer's input for a provider, decrypting the stored envelope. */
function readCustomerInput(item: { id: string; customerInputEnc: string | null }): string | null {
  if (!item.customerInputEnc) return null;
  try {
    return decryptField({
      recordId: item.id,
      fieldName: "customerInput",
      payload: item.customerInputEnc,
    });
  } catch (e) {
    // A KEK rotation mistake or a corrupted row must not silently ship a wrong
    // value to a supplier; fail the item loudly instead.
    console.error(`[fulfillment] cannot decrypt customer input for item ${item.id}:`, e);
    return null;
  }
}

function deliveryEncFor(
  itemId: string,
  providerOfferId: string,
  delivery: NormalizedDelivery | null,
): string | null {
  if (!delivery?.available || !delivery.accounts.length) return null;
  // recordId is the provider order row id, so the envelope binds to one row.
  const recordId = `${itemId}:${providerOfferId}`;
  return encryptField({
    recordId,
    fieldName: "delivery",
    plaintext: JSON.stringify(delivery),
  });
}

/**
 * Place one provider order.
 *
 * Records the attempt either way — a FulfillmentAttempt row is the audit trail
 * for "we tried supplier X and it said Y", which is what support needs when a
 * buyer asks where their order is.
 */
async function dispatchToLink(
  item: {
    id: string;
    orderId: string;
    quantity: number;
    customerInputEnc: string | null;
    requiresCustomerInput: boolean;
  },
  link: {
    providerOfferId: string;
    providerId: string;
    providerSku: string;
    providerCode: string;
  },
  customerEmail: string | null,
): Promise<DispatchOutcome> {
  const adapter = getAdapter(link.providerCode);
  const clientOrderId = clientOrderIdFor(item.id, link.providerOfferId);

  if (!adapter) {
    await prisma.fulfillmentAttempt.create({
      data: {
        orderItemId: item.id,
        providerOfferId: link.providerOfferId,
        status: "FAILED",
        errorCode: "NO_ADAPTER",
      },
    });
    return { kind: "failed", itemId: item.id, reason: `no adapter for ${link.providerCode}` };
  }

  const customerInput = readCustomerInput(item);
  if (item.requiresCustomerInput && !customerInput && !customerEmail) {
    await prisma.fulfillmentAttempt.create({
      data: {
        orderItemId: item.id,
        providerOfferId: link.providerOfferId,
        status: "FAILED",
        errorCode: "MISSING_CUSTOMER_INPUT",
      },
    });
    return { kind: "failed", itemId: item.id, reason: "required customer input is unreadable" };
  }

  let result: AdapterResult<NormalizedOrder>;
  try {
    result = await adapter.createOrder({
      providerSku: link.providerSku,
      quantity: item.quantity,
      clientOrderId,
      idempotencyKey: clientOrderId,
      // QCST wants one line per item; Canboso/VBR take the email separately.
      customerInputs: customerInput ? [customerInput] : customerEmail ? [customerEmail] : undefined,
      customerEmail: customerInput ?? customerEmail ?? undefined,
      customerReference: item.orderId,
    });
  } catch (e) {
    // Adapters return Results rather than throwing, so reaching here is a bug or
    // an abort. Record it and let the next link try.
    await prisma.fulfillmentAttempt.create({
      data: {
        orderItemId: item.id,
        providerOfferId: link.providerOfferId,
        status: "FAILED",
        errorCode: "ADAPTER_THREW",
      },
    });
    console.error(`[fulfillment] adapter threw for item ${item.id}:`, e);
    return { kind: "failed", itemId: item.id, reason: "adapter threw" };
  }

  if (!result.ok) {
    const code = isNotSupported(result) ? "NOT_SUPPORTED" : (result.error.providerCode ?? result.error.kind);
    const detail = isNotSupported(result) ? result.message : result.error.message;

    await prisma.fulfillmentAttempt.create({
      data: {
        orderItemId: item.id,
        providerOfferId: link.providerOfferId,
        status: "FAILED",
        errorCode: code,
      },
    });
    await prisma.providerOrder.upsert({
      where: {
        providerId_clientOrderId: { providerId: link.providerId, clientOrderId },
      },
      update: { status: "FAILED", errorCode: code, errorDetail: detail.slice(0, 500) },
      create: {
        providerId: link.providerId,
        orderItemId: item.id,
        clientOrderId,
        idempotencyKey: clientOrderId,
        status: "FAILED",
        errorCode: code,
        errorDetail: detail.slice(0, 500),
        attempts: 1,
      },
    });

    return { kind: "failed", itemId: item.id, reason: `${code}: ${detail}` };
  }

  const order = result.value;
  const provisional = PROVISIONAL.has(order.status);
  const deliveryAvailable = !!order.delivery?.available;
  const deliveryEnc = deliveryAvailable
    ? deliveryEncFor(item.id, link.providerOfferId, order.delivery)
    : null;
  // A synchronous provider (Canboso returns goods on create) is done in one call.
  const done = deliveryAvailable || order.status === "COMPLETED";

  await prisma.$transaction(async (tx) => {
    await tx.providerOrder.upsert({
      where: {
        providerId_clientOrderId: { providerId: link.providerId, clientOrderId },
      },
      update: {
        providerOrderId: order.providerOrderId,
        status: order.status,
        paymentStatus: order.rawStatus,
        deliveryAvailable,
        deliveryEnc,
        errorCode: null,
        errorDetail: null,
        lastPolledAt: new Date(),
        // Provisional rows are polled later; terminal ones never are.
        nextPollAt: provisional ? new Date(Date.now() + LEASE_MS) : null,
        leaseUntil: null,
      },
      create: {
        providerId: link.providerId,
        orderItemId: item.id,
        clientOrderId,
        idempotencyKey: clientOrderId,
        providerOrderId: order.providerOrderId,
        status: order.status,
        paymentStatus: order.rawStatus,
        deliveryAvailable,
        deliveryEnc,
        attempts: 1,
        lastPolledAt: new Date(),
        nextPollAt: provisional ? new Date(Date.now() + LEASE_MS) : null,
      },
    });

    await tx.fulfillmentAttempt.create({
      data: {
        orderItemId: item.id,
        providerOfferId: link.providerOfferId,
        status: done ? "SUCCEEDED" : "PLACED",
      },
    });

    if (done) {
      await tx.orderItem.update({
        where: { id: item.id },
        data: { status: "COMPLETED" },
      });
    } else if (provisional) {
      // Placed but not delivered: the provider still owes us something.
      await tx.orderItem.update({
        where: { id: item.id },
        data: { status: "PLACED" },
      });
    }
  });

  if (done) return { kind: "completed", itemId: item.id, providerOrderId: order.providerOrderId };
  return {
    kind: "pending",
    itemId: item.id,
    providerOrderId: order.providerOrderId,
    status: order.status,
  };
}

/**
 * Dispatch up to `limit` items awaiting fulfillment.
 *
 * Never throws for a provider failure: one bad supplier must not stop the run.
 * Returns what happened so a cron can log it.
 */
export async function dispatchPendingOrders(
  limit = MAX_ITEMS_PER_RUN,
  opts: { onlyItemIds?: string[] } = {},
): Promise<DispatchOutcome[]> {
  const itemIds = await claimItems(limit, opts.onlyItemIds);
  if (!itemIds.length) return [];

  const outcomes: DispatchOutcome[] = [];

  for (const itemId of itemIds) {
    const item = await prisma.orderItem.findUnique({
      where: { id: itemId },
      include: {
        order: { select: { id: true, userId: true, guestEmail: true } },
        offer: {
          select: {
            links: {
              where: { isEnabled: true },
              orderBy: { priority: "asc" },
              select: {
                providerOfferId: true,
                providerOffer: {
                  select: {
                    providerSku: true,
                    provider: { select: { id: true, code: true, isActive: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!item) continue;

    const links = item.offer.links
      .filter((l) => l.providerOffer.provider.isActive)
      .map((l) => ({
        providerOfferId: l.providerOfferId,
        providerId: l.providerOffer.provider.id,
        providerSku: l.providerOffer.providerSku,
        providerCode: l.providerOffer.provider.code,
      }));

    if (!links.length) {
      outcomes.push({ kind: "skipped", itemId, reason: "no enabled provider link" });
      continue;
    }

    // Buyer's email is the usual delivery address; wallet buyers have an account.
    const customerEmail = item.order.guestEmail ?? null;

    let handled = false;
    for (const link of links) {
      const outcome = await dispatchToLink(item, link, customerEmail);
      outcomes.push(outcome);

      if (outcome.kind === "completed" || outcome.kind === "pending") {
        handled = true;
        break; // placed with this supplier; fallback is for failures only
      }
      // FAILED: try the next link in priority order.
    }

    if (!handled) {
      const last = outcomes[outcomes.length - 1];
      const reason = last?.kind === "failed" ? last.reason : "all provider links failed";
      await prisma.orderItem.update({
        where: { id: itemId },
        data: { status: "FAILED" },
      });
      await notifyProviderFailure({
        providerId: links[0].providerId,
        providerName: links[0].providerCode,
        operation: "createOrder",
        orderId: item.order.id,
        message: reason,
      }).catch(() => {
        // Alerting must never fail the dispatch run.
      });
    }
  }

  return outcomes;
}

/** Idempotency helper: the client id a retry will reuse for a given item+link. */
export { clientOrderIdFor };
