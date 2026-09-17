import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "../src/lib/db";
import {
  requestDeposit,
  approveDeposit,
  rejectDeposit,
  DepositError,
  MIN_DEPOSIT_MINOR,
} from "../src/lib/deposits";

// Integration test — needs the raqmi-pg container (DATABASE_URL in .env).
const EMAIL = "deposit-test@internal.test";
const ADMIN_EMAIL = "deposit-admin-test@internal.test";
let userId: string;
let adminId: string;

async function cleanup() {
  for (const email of [EMAIL, ADMIN_EMAIL]) {
    await prisma.deposit.deleteMany({ where: { user: { email } } });
    await prisma.walletTransaction.deleteMany({ where: { user: { email } } });
    await prisma.wallet.deleteMany({ where: { user: { email } } });
  }
  await prisma.deposit.deleteMany({ where: { reviewedBy: { email: ADMIN_EMAIL } } });
  await prisma.user.deleteMany({ where: { email: { in: [EMAIL, ADMIN_EMAIL] } } });
}

beforeAll(async () => {
  await cleanup();
  userId = (await prisma.user.create({ data: { email: EMAIL } })).id;
  adminId = (await prisma.user.create({ data: { email: ADMIN_EMAIL, role: "ADMIN" } })).id;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.deposit.deleteMany({ where: { userId } });
  await prisma.walletTransaction.deleteMany({ where: { userId } });
  await prisma.wallet.deleteMany({ where: { userId } });
});

const balance = async () =>
  (await prisma.wallet.findUnique({ where: { userId } }))?.balanceMinor ?? 0n;

describe("requestDeposit", () => {
  it("records a PENDING deposit and credits nothing", async () => {
    const d = await requestDeposit({ userId, amountMinor: 2500, method: "USDT_BEP20" });
    expect(d.status).toBe("PENDING");
    expect(d.amountMinor).toBe(2500n);
    expect(await balance()).toBe(0n); // the whole point: no money before review
  });

  it("rejects amounts outside the allowed range", async () => {
    await expect(
      requestDeposit({ userId, amountMinor: MIN_DEPOSIT_MINOR - 1n, method: "MANUAL_BANK" }),
    ).rejects.toThrow(DepositError);
    await expect(
      requestDeposit({ userId, amountMinor: 0, method: "MANUAL_BANK" }),
    ).rejects.toThrow(DepositError);
    await expect(
      requestDeposit({ userId, amountMinor: 10n ** 12n, method: "MANUAL_BANK" }),
    ).rejects.toThrow(DepositError);
    expect(await prisma.deposit.count({ where: { userId } })).toBe(0);
  });
});

describe("approveDeposit", () => {
  it("credits the wallet and records the reviewer", async () => {
    const d = await requestDeposit({ userId, amountMinor: 5000, method: "MANUAL_BANK" });

    const out = await approveDeposit({ depositId: d.id, reviewedById: adminId, reviewNote: "ok" });
    expect(out).toMatchObject({ ok: true, alreadyHandled: false, status: "APPROVED" });
    expect(await balance()).toBe(5000n);

    const row = await prisma.deposit.findUniqueOrThrow({ where: { id: d.id } });
    expect(row.status).toBe("APPROVED");
    expect(row.reviewedById).toBe(adminId);
    expect(row.confirmedAt).not.toBeNull();

    // ledger entry references the deposit, so money is traceable
    const txn = await prisma.walletTransaction.findFirstOrThrow({ where: { userId } });
    expect(txn.type).toBe("DEPOSIT");
    expect(txn.amountMinor).toBe(5000n);
    expect(txn.reference).toBe(d.id);
  });

  it("is idempotent: a second approval credits nothing more", async () => {
    const d = await requestDeposit({ userId, amountMinor: 3000, method: "USDT_TRC20" });

    const first = await approveDeposit({ depositId: d.id });
    const second = await approveDeposit({ depositId: d.id });

    expect(first.alreadyHandled).toBe(false);
    expect(second.alreadyHandled).toBe(true);
    expect(await balance()).toBe(3000n); // not 6000
    expect(await prisma.walletTransaction.count({ where: { userId } })).toBe(1);
  });

  it("credits once when two approvals race", async () => {
    const d = await requestDeposit({ userId, amountMinor: 4200, method: "USDT_BEP20" });

    // Two admins tapping Approve at the same moment, or Telegram redelivering.
    const results = await Promise.all([
      approveDeposit({ depositId: d.id }),
      approveDeposit({ depositId: d.id }),
    ]);

    expect(results.filter((r) => !r.alreadyHandled)).toHaveLength(1);
    expect(await balance()).toBe(4200n);
    expect(await prisma.walletTransaction.count({ where: { userId } })).toBe(1);
  });

  it("will not approve an already-rejected deposit", async () => {
    const d = await requestDeposit({ userId, amountMinor: 1500, method: "MANUAL_BANK" });
    await rejectDeposit({ depositId: d.id, reviewNote: "no proof" });

    const out = await approveDeposit({ depositId: d.id });
    expect(out).toMatchObject({ alreadyHandled: true, status: "REJECTED" });
    expect(await balance()).toBe(0n);
  });

  it("throws NOT_FOUND for an unknown id", async () => {
    await expect(approveDeposit({ depositId: "c".repeat(25) })).rejects.toThrow(DepositError);
  });
});

describe("rejectDeposit", () => {
  it("marks REJECTED and moves no money", async () => {
    const d = await requestDeposit({ userId, amountMinor: 9900, method: "MANUAL_BANK" });

    const out = await rejectDeposit({ depositId: d.id, reviewedById: adminId, reviewNote: "bad" });
    expect(out).toMatchObject({ alreadyHandled: false, status: "REJECTED" });
    expect(await balance()).toBe(0n);
    expect(await prisma.walletTransaction.count({ where: { userId } })).toBe(0);

    const again = await rejectDeposit({ depositId: d.id });
    expect(again.alreadyHandled).toBe(true);
  });

  it("will not reject an already-approved deposit or claw back funds", async () => {
    const d = await requestDeposit({ userId, amountMinor: 2000, method: "USDT_BEP20" });
    await approveDeposit({ depositId: d.id });

    const out = await rejectDeposit({ depositId: d.id });
    expect(out).toMatchObject({ alreadyHandled: true, status: "APPROVED" });
    expect(await balance()).toBe(2000n); // untouched
  });
});
