import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth/session";
import { defaultLocale, locales } from "@/i18n";

export async function POST(request: Request) {
  await deleteSession();

  // 303, not the default 307: 307 preserves the POST method, so the browser
  // would re-POST to the destination (a page route that only accepts GET).
  // 303 explicitly converts the follow-up into a GET.
  const referer = request.headers.get("referer");
  let locale: string = defaultLocale;
  if (referer) {
    try {
      const segment = new URL(referer).pathname.split("/")[1];
      if ((locales as readonly string[]).includes(segment)) locale = segment;
    } catch {
      // Malformed referer: fall back to the default locale.
    }
  }

  return NextResponse.redirect(new URL(`/${locale}`, request.url), 303);
}
