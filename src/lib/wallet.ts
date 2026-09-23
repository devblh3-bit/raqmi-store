import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma, type WalletTxnType } from "@prisma/client";
import { prisma } from "./db";

export class InsufficientFundsError extends Error {
  constructor(
    public readonly balanceMinor: bigint,
    public readonly requestedMinor: bigint,
  ) {
    super(`insufficient funds: balance ${balanceMinor}, requested ${requestedMinor}`);
    this.name = "InsufficientFundsError";
  }
}

export type WalletTxnInput = {
  userId: string;
  /** Positive magnitude in USD minor units; sign comes from credit/debit. */
  amountMinor: bigint | number;
  type: WalletTxnType;
  reference?: string;
  note?: string;
};

export const creditWallet = (input: WalletTxnInput) => applyDelta(input, 1n);
export const debitWallet = (input: WalletTxnInput) => applyDelta(input, -1n);

/** Same credit/debit inside a caller-owned SERIALIZABLE transaction (checkout holds funds atomically with order rows). Caller owns the retry loop. */
export const creditWalletTx = (tx: Prisma.TransactionClient, input: WalletTxnInput) =>
  applyDeltaTx(tx, input, 1n);
export const debitWalletTx = (tx: Prisma.TransactionClient, input: WalletTxnInput) =>
  applyDeltaTx(tx, input, -1n);

export const MAX_TXN_ATTEMPTS = 8; // serializable txns abort on concurrent row updates; retry is the protocol

// Serialization conflicts arrive as P2034 (Prisma ops) or P2010 wrapping Postgres
// 40001/40P01 (raw queries). Nothing committed either way, safe to rerun.
export function isSerializationConflict(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2034") return true;
    if (
      /40001|40P01|could not serialize|deadlock|write conflict/i.test(e.message)
    ) {
      return true;
    }
  }
  if (
    e instanceof Error &&
    /40001|40P01|could not serialize|deadlock|write conflict/i.test(e.message)
  ) {
    return true;
  }
  return false;
}

async function applyDeltaTx(
  tx: Prisma.TransactionClient,
  { userId, amountMinor, type, reference, note }: WalletTxnInput,
  sign: 1n | -1n,
) {
  const amount = BigInt(amountMinor); // throws on non-integer input
  if (amount <= 0n) throw new Error("amountMinor must be a positive integer");

  // Ensure the row exists so FOR UPDATE always has something to lock.
  await tx.$executeRaw`
    INSERT INTO "Wallet" ("id", "userId", "balanceMinor", "updatedAt")
    VALUES (${randomUUID()}, ${userId}, 0, now())
    ON CONFLICT ("userId") DO NOTHING`;
  const [row] = await tx.$queryRaw<{ balanceMinor: bigint }[]>`
    SELECT "balanceMinor" FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;
  const balanceAfter = row.balanceMinor + sign * amount;
  if (balanceAfter < 0n) throw new InsufficientFundsError(row.balanceMinor, amount);
  await tx.wallet.update({ where: { userId }, data: { balanceMinor: balanceAfter } });
  return tx.walletTransaction.create({
    data: {
      userId,
      type,
      amountMinor: sign * amount,
      balanceAfterMinor: balanceAfter,
      reference,
      note,
    },
  });
}

async function applyDelta(input: WalletTxnInput, sign: 1n | -1n) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction((tx) => applyDeltaTx(tx, input, sign), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (e) {
      if (attempt < MAX_TXN_ATTEMPTS && isSerializationConflict(e)) continue;
      throw e;
    }
  }
}
