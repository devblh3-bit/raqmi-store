import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import {
  UserDirectory,
  type SerializedUser,
  type SerializedTierOption,
} from "./user-directory";

export default async function UsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale);

  const [users, tiers] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        wallet: true,
        tier: { select: { id: true, name: true, discountPercent: true } },
        _count: { select: { orders: true } },
        walletTxns: {
          orderBy: { createdAt: "desc" },
          take: 15,
        },
      },
    }),
    prisma.resellerTier.findMany({
      orderBy: { discountPercent: "asc" },
      select: { id: true, name: true, discountPercent: true },
    }),
  ]);

  const serializedUsers: SerializedUser[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    tierId: u.tierId,
    tierName: u.tier?.name ?? null,
    preferredLocale: u.preferredLocale,
    telegramId: u.telegramId ? u.telegramId.toString() : null,
    telegramUsername: u.telegramUsername,
    balanceMinor: u.wallet?.balanceMinor.toString() ?? "0",
    ordersCount: u._count.orders,
    createdAt: u.createdAt.toISOString(),
    recentTxns: u.walletTxns.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amountMinor: tx.amountMinor.toString(),
      balanceAfterMinor: tx.balanceAfterMinor.toString(),
      reference: tx.reference,
      note: tx.note,
      createdAt: tx.createdAt.toISOString(),
    })),
  }));

  const serializedTiers: SerializedTierOption[] = tiers.map((t) => ({
    id: t.id,
    name: t.name,
    discountPercent: t.discountPercent.toString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customer Directory</h1>
        <p className="text-sm text-[var(--fg-muted)] mt-1">
          Review customer profiles, monitor wallet balances, execute audited manual balance adjustments, and manage reseller tier memberships.
        </p>
      </div>

      <UserDirectory users={serializedUsers} tiers={serializedTiers} />
    </div>
  );
}
