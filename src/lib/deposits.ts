import "server-only";

import { Prisma, type DepositMethod, type DepositStatus } from "@prisma/client";
import { prisma } from "./db";
import { creditWalletTx, isSerializationConflict, MAX_TXN_ATTEMPTS } from "./wallet";

export type DepositErrorCode = "BAD_AMOUNT" | "NOT_FOUND" | "ALREADY_REVIEWED";

export class DepositError extends Error {
  constructor(
    public readonly code: DepositErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DepositError";
  }
}

/** Floor/ceiling on a single request; keeps fat-finger amounts out of review. */
export const MIN_DEPOSIT_MINOR = 100n; // $1
export const MAX_DEPOSIT_MINOR = 1_000_000_00n; // $1,000,000

/** Record a deposit request. Credits nothing — an admin (or the chain) decides. */
export async function requestDeposit(input: {
  userId: string;
  amountMinor: bigint | number;
  method: DepositMethod;
  proofImageUrl?: string;
  txHash?: string;
  chain?: string;
}) {
  const amountMinor = BigInt(input.amountMinor); // throws on non-integer
  if (amountMinor < MIN_DEPOSIT_MINOR || amountMinor > MAX_DEPOSIT_MINOR) {
    throw new DepositError("BAD_AMOUNT", `amount must be ${MIN_DEPOSIT_MINOR}..${MAX_DEPOSIT_MINOR} minor units`);
  }
  return prisma.deposit.create({
    data: {
      userId: input.userId,
      amountMinor,
      method: input.method,
      proofImageUrl: input.proofImageUrl,
      txHash: input.txHash,
      chain: input.chain,
      status: "PENDING",
    },
  });
}

export type ReviewOutcome =
  | { ok: true; alreadyHandled: false; status: DepositStatus; balanceMinor?: bigint }
  | { ok: true; alreadyHandled: true; status: DepositStatus };

/**
 * Approve a deposit: mark it APPROVED and credit the wallet in ONE serializable
 * transaction, so money and audit trail cannot diverge.
 *
 * Idempotent by construction. The status flip is an updateMany scoped to
 * not-yet-approved rows, so two admins tapping Approve at the same moment (or
 * Telegram redelivering an update) produce exactly one credit: the loser sees
 * count === 0 and returns alreadyHandled instead of crediting again.
 */
export async function approveDeposit(input: {
  depositId: string;
  reviewedById?: string | null;
  reviewNote?: string;
}): Promise<ReviewOutcome> {
  const { depositId, reviewedById, reviewNote } = input;

  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const deposit = await tx.deposit.findUnique({ where: { id: depositId } });
          if (!deposit) throw new DepositError("NOT_FOUND", `no deposit ${depositId}`);
          if (deposit.status === "APPROVED" || deposit.status === "REJECTED") {
            return { ok: true, alreadyHandled: true, status: deposit.status } as const;
          }

          // The guard that makes this idempotent: only an un-reviewed row flips.
          const claimed = await tx.deposit.updateMany({
            where: { id: depositId, status: { in: ["PENDING", "CONFIRMED_ON_CHAIN"] } },
            data: {
              status: "APPROVED",
              reviewedById: reviewedById ?? null,
              reviewNote,
              confirmedAt: new Date(),
            },
          });
          if (claimed.count !== 1) {
            const fresh = await tx.deposit.findUniqueOrThrow({ where: { id: depositId } });
            return { ok: true, alreadyHandled: true, status: fresh.status } as const;
          }

          const txn = await creditWalletTx(tx, {
            userId: deposit.userId,
            amountMinor: deposit.amountMinor,
            type: "DEPOSIT",
            reference: deposit.id,
            note: reviewNote,
          });

          return {
            ok: true,
            alreadyHandled: false,
            status: "APPROVED" as DepositStatus,
            balanceMinor: txn.balanceAfterMinor,
          } as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      if (attempt < MAX_TXN_ATTEMPTS && isSerializationConflict(e)) continue;
      throw e;
    }
  }
}

/** Reject a deposit. No money moves; same single-flip guard as approve. */
export async function rejectDeposit(input: {
  depositId: string;
  reviewedById?: string | null;
  reviewNote?: string;
}): Promise<ReviewOutcome> {
  const { depositId, reviewedById, reviewNote } = input;

  const deposit = await prisma.deposit.findUnique({ where: { id: depositId } });
  if (!deposit) throw new DepositError("NOT_FOUND", `no deposit ${depositId}`);

  const claimed = await prisma.deposit.updateMany({
    where: { id: depositId, status: { in: ["PENDING", "CONFIRMED_ON_CHAIN"] } },
    data: { status: "REJECTED", reviewedById: reviewedById ?? null, reviewNote },
  });
  if (claimed.count !== 1) {
    const fresh = await prisma.deposit.findUniqueOrThrow({ where: { id: depositId } });
    return { ok: true, alreadyHandled: true, status: fresh.status };
  }
  return { ok: true, alreadyHandled: false, status: "REJECTED" };
}
