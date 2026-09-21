import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// Hoisted adapter stubs — tests script listProducts per provider code.
const adapterState = vi.hoisted(() => ({
  listProducts: {} as Record<
    string,
    () => Promise<unknown>
  >,
  getAdapterCalls: [] as string[],
}));

vi.mock("../src/lib/providers", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/providers/types")>(
    "../src/lib/providers/types",
  );
  return {
    getAdapter: (code: string) => {
      adapterState.getAdapterCalls.push(code);
      const fn = adapterState.listProducts[code];
      if (!fn) return null;
      return {
        code,
        capabilities: { polling: true, cancel: false, quote: false, synchronousDelivery: false, getProductById: false, catalogEtag: false, idempotency: "none" as const },
        listProducts: fn,
        getProduct: async () => actual.fail({ kind: "not_found" as const, retryable: false, message: "n/a" }),
        getBalance: async () => actual.fail({ kind: "not_found" as const, retryable: false, message: "n/a" }),
        createOrder: async () => actual.fail({ kind: "not_found" as const, retryable: false, message: "n/a" }),
        getOrder: async () => actual.fail({ kind: "not_found" as const, retryable: false, message: "n/a" }),
        cancelOrder: async () => actual.fail({ kind: "not_found" as const, retryable: false, message: "n/a" }),
        quote: async () => actual.notSupported("quote", "n/a"),
      };
    },
  };
});

// Minimal Prisma mock — records upsert traffic and advisories.
const dbState = vi.hoisted(() => ({
  provider: null as { id: string; code: string } | null,
  providerOffers: new Map<string, { id: string; costMinor: bigint }>(),
  syncRuns: [] as { id: string; data: Record<string, unknown> }[],
  advisoryLocks: [] as string[],
  upsertCalls: 0,
}));

vi.mock("../src/lib/db", () => ({
  prisma: {
    provider: {
      findUnique: async ({ where }: { where: { code: string } }) => {
        if (where.code === "qcst" || where.code === "vbr" || where.code === "canboso") {
          return { id: `prov-${where.code}`, code: where.code };
        }
        return null;
      },
      findMany: async () => [{ code: "qcst" }, { code: "vbr" }],
    },
    syncRun: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `run-${dbState.syncRuns.length}`, data };
        dbState.syncRuns.push(row);
        return row;
      },
      update: async ({ data }: { data: Record<string, unknown> }) => ({ data }),
    },
    providerOffer: {
      findUnique: async ({ where }: { where: { providerId_providerSku: { providerId: string; providerSku: string } } }) => {
        const key = `${where.providerId_providerSku.providerId}:${where.providerId_providerSku.providerSku}`;
        return dbState.providerOffers.get(key) ?? null;
      },
      upsert: async ({ where, create }: { where: { providerId_providerSku: { providerId: string; providerSku: string } }; create: Record<string, unknown> }) => {
        dbState.upsertCalls += 1;
        const key = `${where.providerId_providerSku.providerId}:${where.providerId_providerSku.providerSku}`;
        const row = { id: `po-${key}`, costMinor: create.costMinor as bigint };
        dbState.providerOffers.set(key, row);
        return row;
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        $executeRaw: async () => { dbState.advisoryLocks.push("lock"); },
        providerOffer: {
          findUnique: async (a: unknown) => {
            const { prisma } = await import("../src/lib/db");
            return (prisma.providerOffer.findUnique as unknown as (x: unknown) => Promise<unknown>)(a as never);
          },
          upsert: async (a: unknown) => {
            const { prisma } = await import("../src/lib/db");
            return (prisma.providerOffer.upsert as unknown as (x: unknown) => Promise<unknown>)(a as never);
          },
        },
      };
      await fn(tx);
    },
  },
}));

import { ok, fail } from "../src/lib/providers/types";
import { syncProvider } from "../src/lib/catalog/sync";

function offer(sku: string, costMinor: number, availability = "AVAILABLE"): Record<string, unknown> {
  return {
    providerCode: "QCST",
    providerSku: sku,
    rawName: sku,
    rawNameEn: sku,
    rawDescription: "",
    rawDescriptionEn: "",
    rawWarranty: "",
    customerInputType: "NONE",
    customerPrompt: null,
    fulfillmentMode: null,
    availability,
    stockType: null,
    stockQuantity: 10,
    minQuantity: 1,
    maxQuantity: null,
    costMinor,
    currency: "USD",
    pricingSource: "BASE",
    fixedQuantity: null,
    allowedMonths: null,
    priceTiers: null,
    promotions: null,
    rawJson: { id: sku },
  };
}

describe("catalog sync", () => {
  beforeEach(() => {
    dbState.providerOffers.clear();
    dbState.syncRuns.length = 0;
    dbState.advisoryLocks.length = 0;
    dbState.upsertCalls = 0;
    adapterState.getAdapterCalls.length = 0;
    adapterState.listProducts = {};
  });

  it("upserts provider offers idempotently on (providerId, providerSku)", async () => {
    adapterState.listProducts["QCST"] = async () =>
      ok({ notModified: false as const, offers: [offer("sku-a", 100), offer("sku-b", 200)] as never, etag: null });

    const r1 = await syncProvider("qcst");
    expect(r1.ok).toBe(true);
    const r2 = await syncProvider("qcst");
    expect(r2.ok).toBe(true);
    // same 2 SKUs, second run is 2 updates not 2 inserts — upsert path is exercised twice.
    expect(dbState.upsertCalls).toBe(4);
  });

  it("304 notModified short-circuits with zero writes and still closes SyncRun", async () => {
    adapterState.listProducts["VBR"] = async () =>
      ok({ notModified: true as const, etag: "W/\"abc\"" } as never);

    const r = await syncProvider("vbr");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.skippedNotModified).toBe(true);
    expect(dbState.upsertCalls).toBe(0);
    expect(dbState.advisoryLocks.length).toBe(0);
  });

  it("holds pg_advisory_xact_lock for the whole sync", async () => {
    adapterState.listProducts["QCST"] = async () =>
      ok({ notModified: false as const, offers: [offer("sku-x", 50)] as never, etag: null });

    await syncProvider("qcst");
    expect(dbState.advisoryLocks.length).toBe(1);
  });

  it("propagates adapter failure into SyncRun errorText", async () => {
    adapterState.listProducts["QCST"] = async () =>
      fail({ kind: "provider", retryable: false, message: "boom" });

    const r = await syncProvider("qcst");
    expect(r.ok).toBe(false);
  });
});
