import "server-only";

import { z } from "zod";

export const productSchema = z.object({
  nameEn: z.string().trim().min(1).max(120),
  nameAr: z.string().trim().min(1).max(120),
  nameFr: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/, "lowercase letters, digits and hyphens only").optional(),
  categoryId: z.string().min(1),
  descriptionEn: z.string().trim().max(2000).optional(),
  descriptionAr: z.string().trim().max(2000).optional(),
  descriptionFr: z.string().trim().max(2000).optional(),
  shortEn: z.string().trim().max(300).optional(),
  shortAr: z.string().trim().max(300).optional(),
  shortFr: z.string().trim().max(300).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isNew: z.boolean().optional(),
  contentLocked: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export const attachOfferSchema = z.object({
  offerId: z.string().min(1),
  productId: z.string().min(1),
});

export const detachOfferSchema = z.object({
  offerId: z.string().min(1),
});

export const updateOfferLabelsSchema = z.object({
  offerId: z.string().min(1),
  labelEn: z.string().trim().min(1).max(120),
  labelAr: z.string().trim().min(1).max(120),
  labelFr: z.string().trim().min(1).max(120),
  rulesEn: z.string().trim().max(4000).optional(),
  rulesAr: z.string().trim().max(4000).optional(),
  rulesFr: z.string().trim().max(4000).optional(),
});

export const createOfferFromProviderSchema = z.object({
  productId: z.string().min(1),
  providerOfferId: z.string().min(1),
  labelEn: z.string().trim().min(1).max(120),
  labelAr: z.string().trim().min(1).max(120),
  labelFr: z.string().trim().min(1).max(120),
  rulesEn: z.string().trim().max(4000).optional().default(""),
  rulesAr: z.string().trim().max(4000).optional().default(""),
  rulesFr: z.string().trim().max(4000).optional().default(""),
  markupPercent: z.coerce.number().min(0).max(1000).default(0),
  compareAtMinor: z.coerce.number().int().min(0).optional().nullable(),
  badge: z.string().trim().max(40).optional().nullable(),
});

export const attachBackupProviderSchema = z.object({
  offerId: z.string().min(1),
  providerOfferId: z.string().min(1),
});

export const updateOfferFullSchema = z.object({
  offerId: z.string().min(1),
  labelEn: z.string().trim().min(1).max(120),
  labelAr: z.string().trim().min(1).max(120),
  labelFr: z.string().trim().min(1).max(120),
  rulesEn: z.string().trim().max(4000).optional().default(""),
  rulesAr: z.string().trim().max(4000).optional().default(""),
  rulesFr: z.string().trim().max(4000).optional().default(""),
  markupPercent: z.coerce.number().min(0).max(1000).default(0),
  compareAtMinor: z.coerce.number().int().min(0).optional().nullable(),
  badge: z.string().trim().max(40).optional().nullable(),
});

export const toggleLinkSchema = z.object({
  linkId: z.string().min(1),
  isEnabled: z.coerce.boolean(),
});

export const deleteLinkSchema = z.object({
  linkId: z.string().min(1),
});

export const reorderLinkSchema = z.object({
  linkId: z.string().min(1),
  direction: z.enum(["up", "down"]),
});

export const retryOrderItemSchema = z.object({
  orderItemId: z.string().min(1),
});

export const manualFulfillItemSchema = z.object({
  orderItemId: z.string().min(1),
  payload: z.string().trim().min(1, "Delivery credentials or keys cannot be empty"),
});

export const refundOrderItemSchema = z.object({
  orderItemId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});

export const refundOrderSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});

export const adjustBalanceSchema = z.object({
  userId: z.string().min(1),
  direction: z.enum(["credit", "debit"]),
  amountMinor: z.coerce.number().int().positive("Amount must be a positive integer in cents"),
  reason: z.string().trim().min(3, "Mandatory audit reason must be at least 3 characters").max(500),
});

export const updateUserRoleTierSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["CUSTOMER", "RESELLER_APPLICANT", "RESELLER", "ADMIN"]),
  tierId: z.string().nullable().optional(),
});

export const reviewResellerApplicationSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  tierId: z.string().optional(),
  note: z.string().trim().max(500).optional(),
});

export const tierSchema = z.object({
  name: z.string().trim().min(1, "Tier name is required").max(50),
  discountPercent: z.coerce.number().min(0, "Discount cannot be negative").max(100, "Discount cannot exceed 100%"),
  minDepositMinor: z.coerce.number().int().min(0).default(0),
});

export const setTierPriceOverrideSchema = z.object({
  offerId: z.string().min(1),
  tierId: z.string().min(1),
  priceMinor: z.coerce.number().int().positive("Price override must be positive"),
});

export const deleteTierPriceOverrideSchema = z.object({
  offerId: z.string().min(1),
  tierId: z.string().min(1),
});

export const categorySchema = z.object({
  nameEn: z.string().trim().min(1, "English name is required").max(100),
  nameAr: z.string().trim().min(1, "Arabic name is required").max(100),
  nameFr: z.string().trim().min(1, "French name is required").max(100),
  slug: z.string().trim().max(100).optional(),
  descriptionEn: z.string().trim().max(1000).optional().default(""),
  descriptionAr: z.string().trim().max(1000).optional().default(""),
  descriptionFr: z.string().trim().max(1000).optional().default(""),
  image: z.string().trim().optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.coerce.boolean().default(true),
});

export const updateCategorySchema = categorySchema.extend({
  id: z.string().min(1),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function deriveSlug(nameEn: string, existingSlug?: string): string {
  if (existingSlug?.trim()) return existingSlug.trim().toLowerCase();
  return slugify(nameEn);
}
