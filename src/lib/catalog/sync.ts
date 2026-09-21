import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { getAdapter } from "../providers";
import type {
  NormalizedProviderOffer,
  ProviderCode,
} from "../providers/types";

/**
 * Catalog sync — plan §3, supplement Slice 1.
 *
 * Contract: sync populates the searchable `ProviderOffer` pool via
 * `listProducts()` and never auto-creates or re-parents `Offer` rows.
 * Offers are curated by an admin (D2). When an `Offer` has
 * `productPinned === true`, a future auto-grouping step must skip it —
 * this module already satisfies that by never touching `Offer` at all.
 * Only the linked `ProviderOffer.costMinor/availability/stockQuantity`
 * flow through, so `computeOfferPrice` reflects live data while the
 * admin's labels survive.
 */

// ------------------------------------------------------------------ types

export type SyncResult =
  | {
      ok: true;
      providerCode: ProviderCode;
      syncRunId: string;
      inserted: number;
      updated: number;
      skippedNotModified: boolean;
    }
  | { ok: false; providerCode: string; error: string; syncRunId?: string };

// -------------------------------------------------------------- helpers

function providerRowCode(code: ProviderCode): string {
  return code.toLowerCase(); // DB stores qcst | vbr | canboso
}

function toProviderOfferData(
  po: NormalizedProviderOffer,
  providerId: string,
) {
  return {
    providerId,
    providerSku: po.providerSku,
    rawName: po.rawName ?? "",
    rawNameEn: po.rawNameEn ?? "",
    rawDescription: po.rawDescription ?? "",
    rawDescriptionEn: po.rawDescriptionEn ?? "",
    rawWarranty: po.rawWarranty ?? "",
    customerInputType: po.customerInputType ?? null,
    customerPrompt: po.customerPrompt ?? null,
    fulfillmentMode: po.fulfillmentMode ?? null,
    availability: po.availability ?? "UNKNOWN",
    stockType: po.stockType ?? null,
    stockQuantity: po.stockQuantity ?? null,
    minQuantity: po.minQuantity ?? 1,
    maxQuantity: po.maxQuantity ?? null,
    costMinor: BigInt(po.costMinor),
    currency: po.currency,
    pricingSource: po.pricingSource ?? null,
    rawJson: po.rawJson === undefined || po.rawJson === null ? Prisma.JsonNull : (po.rawJson as Prisma.InputJsonValue),
    lastSyncedAt: new Date(),
  };
}

// ----------------------------------------------------------- entry point

export async function syncProvider(
  code: string,
): Promise<SyncResult> {
  const normalized = code.trim().toUpperCase() as ProviderCode;
  const rowCode = providerRowCode(normalized);

  const provider = await prisma.provider.findUnique({
    where: { code: rowCode },
  });
  if (!provider) {
    return { ok: false, providerCode: code, error: `unknown provider ${code}` };
  }

  const adapter = getAdapter(normalized);
  if (!adapter) {
    return {
      ok: false,
      providerCode: normalized,
      error: `no adapter for ${code}`,
    };
  }

  const syncRun = await prisma.syncRun.create({
    data: { providerId: provider.id },
  });

  // Advisory lock so sync and checkout's SERIALIZABLE fallback loop cannot
  // interleave mid-upsert. Lock is transaction-scoped; released on commit.
  // We keep the lock for the whole sync, not per-row, to avoid row-by-row churn.
  const lockAndUpsert = async (
    offers: NormalizedProviderOffer[],
    etag: string | null,
  ): Promise<{ inserted: number; updated: number }> => {
    let inserted = 0;
    let updated = 0;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${provider.id}))`;

      for (const po of offers) {
        const data = toProviderOfferData(po, provider.id);
        const existing = await tx.providerOffer.findUnique({
          where: {
            providerId_providerSku: {
              providerId: provider.id,
              providerSku: po.providerSku,
            },
          },
          select: { id: true },
        });

        await tx.providerOffer.upsert({
          where: {
            providerId_providerSku: {
              providerId: provider.id,
              providerSku: po.providerSku,
            },
          },
          create: {
            ...data,
            etag: etag ?? undefined,
          },
          update: {
            ...data,
            etag: etag ?? undefined,
          },
        });

        if (existing) updated += 1;
        else inserted += 1;
      }
    });

    return { inserted, updated };
  };

  try {
    // VBR supports If-None-Match; forward any stored etag.
    // QCST/Canboso ignore the option — listProducts just fetches.
    const etag: string | null = null;
    const result = await adapter.listProducts(
      etag ? { etag } : undefined,
    );

    if (!result.ok) {
      if ("notSupported" in result && result.notSupported) {
        await prisma.syncRun.update({
          where: { id: syncRun.id },
          data: {
            finishedAt: new Date(),
            errors: 1,
            errorText: result.message,
          },
        });
        return {
          ok: false,
          providerCode: normalized,
          error: result.message,
          syncRunId: syncRun.id,
        };
      }
      const err = (result as { error: { message: string } }).error;
      await prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          finishedAt: new Date(),
          errors: 1,
          errorText: err.message,
        },
      });
      return {
        ok: false,
        providerCode: normalized,
        error: err.message,
        syncRunId: syncRun.id,
      };
    }

    const list = result.value;

    // VBR 304 — catalog unchanged.
    if (list.notModified) {
      await prisma.syncRun.update({
        where: { id: syncRun.id },
        data: { finishedAt: new Date(), inserted: 0, updated: 0 },
      });
      return {
        ok: true,
        providerCode: normalized,
        syncRunId: syncRun.id,
        inserted: 0,
        updated: 0,
        skippedNotModified: true,
      };
    }

    const { inserted, updated } = await lockAndUpsert(
      list.offers,
      list.etag,
    );

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        finishedAt: new Date(),
        inserted,
        updated,
        errors: 0,
      },
    });

    return {
      ok: true,
      providerCode: normalized,
      syncRunId: syncRun.id,
      inserted,
      updated,
      skippedNotModified: false,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { finishedAt: new Date(), errors: 1, errorText: msg },
    });
    return {
      ok: false,
      providerCode: normalized,
      error: msg,
      syncRunId: syncRun.id,
    };
  }
}

export async function syncAllProviders(): Promise<SyncResult[]> {
  const providers = await prisma.provider.findMany({
    where: {
      code: { in: ["qcst", "vbr", "canboso"] },
      isActive: true,
    },
    select: { code: true },
  });

  const results: SyncResult[] = [];
  for (const p of providers) {
    results.push(await syncProvider(p.code));
  }
  return results;
}
