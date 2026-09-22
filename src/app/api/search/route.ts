import { NextResponse } from "next/server";
import { getProducts } from "@/lib/catalog";
import type { Locale } from "@/i18n";

export const dynamic = "force-dynamic";

export interface SearchProductResult {
  slug: string;
  name: string;
  category: string;
  image: string;
  minPrice: number;
  offersCount: number;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const locale = (searchParams.get("locale") ?? "en") as Locale;

  try {
    const products = await getProducts(locale);
    if (!q) {
      return NextResponse.json(
        products.slice(0, 6).map((p) => ({
          slug: p.slug,
          name: p.name,
          category: p.category,
          image: p.image,
          minPrice: Math.min(...p.offers.map((o) => o.price)),
          offersCount: p.offers.length,
        }))
      );
    }

    const filtered = products.filter(
      (p) =>
        p.slug.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );

    return NextResponse.json(
      filtered.slice(0, 8).map((p) => ({
        slug: p.slug,
        name: p.name,
        category: p.category,
        image: p.image,
        minPrice: Math.min(...p.offers.map((o) => o.price)),
        offersCount: p.offers.length,
      }))
    );
  } catch (error) {
    console.error("[api/search] search query failed", error);
    return NextResponse.json([], { status: 500 });
  }
}
