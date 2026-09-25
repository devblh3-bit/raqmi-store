import { NextResponse } from "next/server";
import { getSession, touchSession, deleteSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  return NextResponse.json({
    authenticated: true,
    userId: session.userId,
    role: session.role,
    remember: Boolean(session.remember),
    lastActive: session.lastActive,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (body?.action === "logout") {
    await deleteSession();
    return NextResponse.json({ ok: true, loggedOut: true });
  }

  const touched = await touchSession();
  return NextResponse.json({ ok: true, touched });
}
