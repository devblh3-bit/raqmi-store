import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { debitWalletTx, isSerializationConflict, MAX_TXN_ATTEMPTS } from "./wallet";
import { priceForOffer } from "./pricing";
import { generateOrderCode } from "./order-code";
import { encryptField } from "./crypto";

export type CheckoutErrorCode =
  | "EMPTY_CART"
  | "BAD_QUANTITY"
  | "OFFER_UNAVAILABLE"
  | "INPUT_REQUIRED";

export class CheckoutError extends Error {
  constructor(
    public readonly code: CheckoutErrorCode,
    message: string,
    public readonly offerId?: string,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export type CheckoutLine = {
  offerId: string;
  quantity?: number;
  /** Plaintext; encrypted at rest. Required when the provider offer asks for input. */
  customerInput?: string;
};

type PricedLine = {
  id: string;
  offerId: string;
  quantity: number;
  unitPriceMinor: bigint;
  unitCostMinor: bigint;
  procurementCostUsdMinor: bigint;
  agencyFeeMinor: bigint;
  costCurrency: string;
  fxRateSnapshot: number | null;
  requiresCustomerInput: boolean;
  customerInput?: string;
};

const MAX_QTY = 100;

/**
 * Buy with wallet funds. Pricing is snapshotted per line, then the debit and the
 * order rows commit in ONE serializable transaction: a failed debit leaves no
 * order, and a failed insert leaves the balance untouched.
 *
 * Throws InsufficientFundsError (from wallet.ts) or CheckoutError.
 * ponytail: no stock reservation and no min/max-quantity enforcement — provider
 * stock is authoritative at fulfillment, which is where oversell surfaces today.
 * Upgrade path: decrement ProviderOffer.stockQuantity in this same transaction.
 */
export async function placeOrder(input: {
  userId: string;
  guestEmail?: string;
  lines: CheckoutLine[];
  locale?: string;
}) {
  const { userId, lines, locale = "en", guestEmail } = input;
  if (!lines.length) throw new CheckoutError("EMPTY_CART", "no items to order");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, tierId: true },
  });

  // Price + snapshot outside the transaction: priceForOffer writes its own
  // OfferComputedPrice cache, which has no business inside the money txn.
  const priced: PricedLine[] = [];
  for (const line of lines) {
    const quantity = line.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) {
      throw new CheckoutError("BAD_QUANTITY", `quantity must be 1..${MAX_QTY}`, line.offerId);
    }

    const price = await priceForOffer(line.offerId, user.tierId);
    if (!price.available) {
      throw new CheckoutError("OFFER_UNAVAILABLE", `offer unavailable: ${price.reason}`, line.offerId);
    }

    const providerOffer = await prisma.providerOffer.findUniqueOrThrow({
      where: { id: price.providerOfferId },
      select: { costMinor: true, currency: true, customerInputType: true },
    });

    const inputType = providerOffer.customerInputType;
    const requiresCustomerInput = !!inputType && inputType !== "none";
    if (requiresCustomerInput && !line.customerInput?.trim()) {
      throw new CheckoutError("INPUT_REQUIRED", `offer needs customer input (${inputType})`, line.offerId);
    }

    const procurementCostUsdMinor = BigInt(price.costMinor);
    const agencyFeeMinor = BigInt(Math.max(0, price.priceMinor - price.costMinor));

    priced.push({
      id: randomUUID(), // known up front so the encryption AAD binds to the real row id
      offerId: line.offerId,
      quantity,
      unitPriceMinor: BigInt(price.priceMinor),
      unitCostMinor: providerOffer.costMinor,
      procurementCostUsdMinor,
      agencyFeeMinor,
      costCurrency: providerOffer.currency,
      fxRateSnapshot: price.breakdown.fxRate,
      requiresCustomerInput,
      customerInput: requiresCustomerInput ? line.customerInput!.trim() : undefined,
    });
  }

  const totalMinor = priced.reduce((sum, l) => sum + l.unitPriceMinor * BigInt(l.quantity), 0n);
  const code = generateOrderCode(); // reused across retries; nothing commits on a conflict

  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await debitWalletTx(tx, {
            userId,
            amountMinor: totalMinor,
            type: "PURCHASE",
            reference: code,
          });
          return tx.order.create({
            data: {
              code,
              userId,
              guestEmail: guestEmail ?? user.email,
              status: "PAID",
              paymentStatus: "PAID",
              totalMinor,
              locale,
              items: {
                create: priced.map((l) => ({
                  id: l.id,
                  offerId: l.offerId,
                  quantity: l.quantity,
                  unitPriceMinor: l.unitPriceMinor,
                  unitCostMinor: l.unitCostMinor,
                  procurementCostUsdMinor: l.procurementCostUsdMinor,
                  agencyFeeMinor: l.agencyFeeMinor,
                  costCurrency: l.costCurrency,
                  fxRateSnapshot: l.fxRateSnapshot,
                  requiresCustomerInput: l.requiresCustomerInput,
                  customerInputEnc: l.customerInput
                    ? encryptField({
                        recordId: l.id,
                        fieldName: "customerInput",
                        plaintext: l.customerInput,
                      })
                    : null,
                })),
              },
            },
            include: { items: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      if (attempt < MAX_TXN_ATTEMPTS && isSerializationConflict(e)) continue;
      throw e;
    }
  }
}
