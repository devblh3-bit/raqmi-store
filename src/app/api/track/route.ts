import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeOrderCode } from "@/lib/order-code";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawCode = (body.code ?? "").toString();
    const rawEmail = (body.email ?? "").toString().trim().toLowerCase();
    const locale = (body.locale ?? "en").toString();

    const code = normalizeOrderCode(rawCode);
    if (!code) {
      return NextResponse.json(
        { ok: false, error: "INVALID_CODE" },
        { status: 400 },
      );
    }

    const order = await prisma.order.findUnique({
      where: { code },
      include: {
        user: { select: { email: true } },
      },
    });

    if (!order) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // If an email was provided, verify it matches
    if (rawEmail) {
      const guestEmail = (order.guestEmail ?? "").toLowerCase().trim();
      const userEmail = (order.user?.email ?? "").toLowerCase().trim();

      if (guestEmail !== rawEmail && userEmail !== rawEmail) {
        return NextResponse.json(
          { ok: false, error: "EMAIL_MISMATCH" },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({
      ok: true,
      redirectUrl: `/${locale}/orders/${order.code}`,
      code: order.code,
    });
  } catch (error) {
    console.error("[api/track] Error handling tracking request:", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
