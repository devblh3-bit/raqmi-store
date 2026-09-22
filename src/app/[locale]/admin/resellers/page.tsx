import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { priceForOffer } from "@/lib/pricing";
import {
  ResellerManager,
  type SerializedApplicant,
  type SerializedTier,
  type SerializedMatrixOffer,
} from "./reseller-manager";

export default async function ResellersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale);

  const [applicants, tiers, offers] = await Promise.all([
    prisma.user.findMany({
      where: { role: "RESELLER_APPLICANT" },
      orderBy: { createdAt: "desc" },
      include: {
        wallet: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.resellerTier.findMany({
      orderBy: { discountPercent: "asc" },
      include: {
        _count: { select: { users: true, overrides: true } },
      },
    }),
    prisma.offer.findMany({
      where: { isActive: true },
      orderBy: [{ product: { nameEn: "asc" } }, { labelEn: "asc" }],
      include: {
        product: { select: { nameEn: true } },
        links: {
          where: { isEnabled: true },
          orderBy: { priority: "asc" },
          include: { providerOffer: { select: { costMinor: true } } },
          take: 1,
        },
        tierOverrides: true,
      },
    }),
  ]);

  const serializedApplicants: SerializedApplicant[] = applicants.map((a) => ({
    id: a.id,
    email: a.email,
    telegramUsername: a.telegramUsername,
    balanceMinor: a.wallet?.balanceMinor.toString() ?? "0",
    ordersCount: a._count.orders,
    createdAt: a.createdAt.toISOString(),
  }));

  const serializedTiers: SerializedTier[] = tiers.map((t) => ({
    id: t.id,
    name: t.name,
    discountPercent: t.discountPercent.toString(),
    minDepositMinor: t.minDepositMinor.toString(),
    membersCount: t._count.users,
    overridesCount: t._count.overrides,
  }));

  // Fetch prices for active offers
  const serializedOffers: SerializedMatrixOffer[] = await Promise.all(
    offers.map(async (offer) => {
      const quote = await priceForOffer(offer.id);
      const retailPriceMinor = quote.available ? quote.priceMinor.toString() : "0";
      const costMinor = quote.available
        ? quote.costMinor.toString()
        : offer.links[0]?.providerOffer.costMinor.toString() ?? "0";

      const overrides: Record<string, string> = {};
      for (const ov of offer.tierOverrides) {
        overrides[ov.tierId] = ov.priceMinor.toString();
      }

      return {
        id: offer.id,
        productNameEn: offer.product.nameEn,
        labelEn: offer.labelEn,
        retailPriceMinor,
        costMinor,
        overrides,
      };
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reseller Program Management</h1>
        <p className="text-sm text-[var(--fg-muted)] mt-1">
          Review reseller applications, configure wholesale discount tiers, and establish fixed price overrides across product variants.
        </p>
      </div>

      <ResellerManager
        applicants={serializedApplicants}
        tiers={serializedTiers}
        offers={serializedOffers}
      />
    </div>
  );
}

