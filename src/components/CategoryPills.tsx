import Link from "next/link";
import type { Locale } from "@/i18n";
import { categories } from "@/data/catalog";

export default function CategoryPills({ locale, active }: { locale: Locale; active?: string }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
      <Link
        href={`/${locale}/categories`}
        className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${!active ? "border-[var(--fg)] bg-[var(--fg)] text-white" : "border-[var(--border)] bg-white text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"}`}
      >
        All
      </Link>
      {categories.map((c) => (
        <Link
          key={c.slug}
          href={`/${locale}/categories/${c.slug}`}
          className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${active === c.slug ? "border-[var(--fg)] bg-[var(--fg)] text-white" : "border-[var(--border)] bg-white text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"}`}
        >
          {c.name[locale] ?? c.name.en} {c.count ? <span className="opacity-60">· {c.count}</span> : null}
        </Link>
      ))}
    </div>
  );
}
