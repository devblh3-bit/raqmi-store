import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function WalletPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login?next=/${locale}/account/wallet`);
  }

  if (session.role === "RESELLER") {
    redirect(`/${locale}/reseller/wallet`);
  }

  if (session.role === "ADMIN") {
    redirect(`/${locale}/admin/deposits`);
  }

  redirect(`/${locale}/account/wallet`);
}
