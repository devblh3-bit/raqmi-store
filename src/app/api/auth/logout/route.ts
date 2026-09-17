import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth/session";
import { defaultLocale } from "@/i18n";

export async function POST(request: Request) {
  await deleteSession();
  return NextResponse.redirect(new URL(`/${defaultLocale}`, request.url));
}
