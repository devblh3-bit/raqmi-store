import { NextResponse } from "next/server";
import { dispatchPendingOrders } from "@/lib/fulfillment";

/**
 * Fulfillment tick. Point a cron at it (every minute or so) with the secret in
 * the `x-cron-secret` header:
 *
 *   curl -X POST https://shop.example/api/cron/fulfillment \
 *     -H "x-cron-secret: $CRON_SECRET"
 *
 * Auth fails closed like the Telegram webhook: an unset secret rejects every
 * request rather than leaving an open endpoint that places real supplier orders.
 */
export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || !expected.trim()) {
    return NextResponse.json({ error: "cron secret not configured" }, { status: 401 });
  }
  // Constant-time compare would be nicer; this endpoint is not a credential
  // oracle (no per-guess feedback beyond 401), so a plain compare is adequate.
  if (request.headers.get("x-cron-secret") !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const outcomes = await dispatchPendingOrders();

  const summary = {
    claimed: outcomes.length,
    completed: outcomes.filter((o) => o.kind === "completed").length,
    pending: outcomes.filter((o) => o.kind === "pending").length,
    failed: outcomes.filter((o) => o.kind === "failed").length,
    skipped: outcomes.filter((o) => o.kind === "skipped").length,
  };

  return NextResponse.json({ ok: true, summary, outcomes });
}
