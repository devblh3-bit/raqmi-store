import "server-only";

import { prisma } from "./db";
import { priceForOffer } from "./pricing";
import { tryDecryptField } from "./crypto";
import type { RateSheetItem, DeliveredOrderItem } from "@/components/ResellerCockpit";

/**
 * Build the wholesale rate sheet for a given reseller tier.
 * Calculates retail price vs. tier wholesale price and net margin.
 */
export async function getResellerRateSheet(tierId: string): Promise<RateSheetItem[]> {
  const tier = await prisma.resellerTier.findUnique({ where: { id: tierId } });
  if (!tier) return [];

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      slug: true,
      nameEn: true,
      category: { select: { slug: true } },
      offers: {
        where: { isActive: true },
        select: {
          id: true,
          labelEn: true,
        },
        orderBy: [{ sortOrder: "asc" }],
      },
    },
    orderBy: [{ sortOrder: "asc" }],
  });

  const items: RateSheetItem[] = [];

  for (const p of products) {
    for (const o of p.offers) {
      const [retailPrice, wholesalePrice] = await Promise.all([
        priceForOffer(o.id, null),
        priceForOffer(o.id, tierId),
      ]);

      if (retailPrice.available && wholesalePrice.available) {
        const retailMinor = retailPrice.priceMinor;
        const wholesaleMinor = wholesalePrice.priceMinor;
        const marginMinor = Math.max(0, retailMinor - wholesaleMinor);
        const marginPercent = retailMinor > 0 ? (marginMinor / retailMinor) * 100 : 0;

        items.push({
          offerId: o.id,
          productSlug: p.slug,
          productName: p.nameEn,
          variantLabel: o.labelEn,
          category: p.category.slug,
          retailPriceMinor: retailMinor,
          wholesalePriceMinor: wholesaleMinor,
          marginMinor,
          marginPercent,
        });
      }
    }
  }

  return items;
}

/**
 * Load delivered orders with decrypted credentials for a reseller customer.
 */
export async function getResellerOrdersWithKeys(userId: string): Promise<DeliveredOrderItem[]> {
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: {
      items: {
        include: {
          offer: {
            include: {
              product: { select: { nameEn: true, slug: true } },
            },
          },
        },
      },
    },
  });

  const result: DeliveredOrderItem[] = [];

  for (const o of orders) {
    for (const item of o.items) {
      let deliveredPayload: string | null = null;
      if (item.deliveryPayloadEnc) {
        const dec = tryDecryptField({
          recordId: item.id,
          fieldName: "deliveryPayloadEnc",
          payload: item.deliveryPayloadEnc,
        });
        if (dec.ok) {
          deliveredPayload = dec.value;
        }
      }

      result.push({
        id: item.id,
        orderCode: o.code,
        createdAt: o.createdAt.toISOString(),
        status: item.status,
        productName: item.offer.product.nameEn,
        variantLabel: item.offer.labelEn,
        quantity: item.quantity,
        totalMinor: Number(item.unitPriceMinor) * item.quantity,
        deliveredPayload,
      });
    }
  }

  return result;
}
