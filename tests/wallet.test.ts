import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "../src/lib/db";
import { creditWallet, debitWallet, InsufficientFundsError } from "../src/lib/wallet";

// Integration test — needs the raqmi-pg container (DATABASE_URL in .env).
const EMAIL = "wallet-test@internal.test";
let userId: string;

beforeAll(async () => {
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {},
    create: { email: EMAIL },
  });
  userId = user.id;
  await prisma.walletTransaction.deleteMany({ where: { userId } });
  await prisma.wallet.deleteMany({ where: { userId } });
});

afterAll(async () => {
  await prisma.walletTransaction.deleteMany({ where: { userId } });
  await prisma.wallet.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("wallet", () => {
  it("credit creates wallet and ledger row; debit reduces it", async () => {
    const credit = await creditWallet({ userId, amountMinor: 1000, type: "DEPOSIT", reference: "dep1" });
    expect(credit.amountMinor).toBe(1000n);
    expect(credit.balanceAfterMinor).toBe(1000n);

    const debit = await debitWallet({ userId, amountMinor: 300, type: "PURCHASE", reference: "ord1" });
    expect(debit.amountMinor).toBe(-300n);
    expect(debit.balanceAfterMinor).toBe(700n);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    expect(wallet.balanceMinor).toBe(700n);
  });

  it("rejects overdraft without writing anything", async () => {
    const before = await prisma.walletTransaction.count({ where: { userId } });
    await expect(
      debitWallet({ userId, amountMinor: 999999, type: "PURCHASE" }),
    ).rejects.toBeInstanceOf(InsufficientFundsError);
    expect(await prisma.walletTransaction.count({ where: { userId } })).toBe(before);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    expect(wallet.balanceMinor).toBe(700n);
  });

  it("rejects zero, negative, and non-integer amounts", async () => {
    await expect(creditWallet({ userId, amountMinor: 0, type: "DEPOSIT" })).rejects.toThrow();
    await expect(creditWallet({ userId, amountMinor: -5, type: "DEPOSIT" })).rejects.toThrow();
    await expect(creditWallet({ userId, amountMinor: 1.5, type: "DEPOSIT" })).rejects.toThrow();
  });

  it("concurrent debits never overdraw (serializable + FOR UPDATE)", async () => {
    // balance is 700; fire 7 concurrent debits of 200 — at most 3 can succeed.
    const results = await Promise.allSettled(
      Array.from({ length: 7 }, () => debitWallet({ userId, amountMinor: 200, type: "PURCHASE" })),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(3);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    expect(wallet.balanceMinor).toBe(100n);
    // ledger sums to balance
    const txns = await prisma.walletTransaction.findMany({ where: { userId } });
    const sum = txns.reduce((acc, t) => acc + t.amountMinor, 0n);
    expect(sum).toBe(100n);
  });
});
