import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import {
  CategoryManager,
  type SerializedCategory,
} from "./category-manager";

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale);

  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { products: true } },
    },
  });

  const serializedCategories: SerializedCategory[] = categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    nameEn: c.nameEn,
    nameAr: c.nameAr,
    nameFr: c.nameFr,
    descriptionEn: c.descriptionEn,
    descriptionAr: c.descriptionAr,
    descriptionFr: c.descriptionFr,
    image: c.image,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    productsCount: c._count.products,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Category Management</h1>
        <p className="text-sm text-[var(--fg-muted)] mt-1">
          Organize storefront navigation, configure localized names in Arabic, English, and French, and control category visibility.
        </p>
      </div>

      <CategoryManager categories={serializedCategories} />
    </div>
  );
}
