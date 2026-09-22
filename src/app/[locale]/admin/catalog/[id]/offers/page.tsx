import { redirect } from "next/navigation";

export default async function OffersPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  redirect(`/${locale}/admin/catalog/${id}`);
}
