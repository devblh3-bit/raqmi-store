import "server-only";

import { redirect, notFound } from "next/navigation";
import { getSession } from "./session";

/** Throws redirect/notFound when the caller is not ADMIN. Returns the session when they are. */
export async function requireAdmin(locale?: string) {
  const session = await getSession();
  if (!session) {
    // locale-aware redirect when we know it; otherwise generic.
    redirect(locale ? `/${locale}/login` : "/en/login");
  }
  if (session.role !== "ADMIN") notFound();
  return session;
}
