import { NextResponse } from "next/server";
import { syncAllProviders } from "@/lib/catalog/sync";

/**
 * Catalog sync tick. Point a cron at it every 15 minutes with the secret in
 * the `x-cron-secret` header (Vercel Cron schedule star/15 every 15 min):
 *
 *   curl -X POST https://shop.example/api/cron/sync-providers \
 *     -H "x-cron-secret: $CRON_SECRET"
 *
 * Fails closed when CRON_SECRET is unset, mirroring
 * `src/app/api/cron/fulfillment/route.ts` and the Telegram webhook guard.
 */
export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || !expected.trim()) {
    return NextResponse.json(
      { error: "cron secret not configured" },
      { status: 401 },
    );
  }
  if (request.headers.get("x-cron-secret") !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const runs = await syncAllProviders();

  const ok = runs.every((r) => r.ok);
  return NextResponse.json(
    { ok, runs },
    { status: ok ? 200 : 207 },
  );
}
