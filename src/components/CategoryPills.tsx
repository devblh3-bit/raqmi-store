import Link from "next/link";
import type { Locale } from "@/i18n";
import { categories } from "@/data/catalog";

export default function CategoryPills({ locale, active }: { locale: Locale; active?: string }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Link
        href={`/${locale}/categories`}
        className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium tracking-tight transition-all duration-300 ease-[var(--ease-premium)] ${!active ? "border-[var(--fg)] bg-[var(--fg)] text-white shadow-sm dark:border-white dark:bg-white dark:text-black" : "border-black/[0.08] dark:border-white/11 bg-[var(--surface)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"}`}
      >
        All
      </Link>
      {categories.map((c) => (
        <Link
          key={c.slug}
          href={`/${locale}/categories/${c.slug}`}
          className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium tracking-tight transition-all duration-300 ease-[var(--ease-premium)] ${active === c.slug ? "border-[var(--fg)] bg-[var(--fg)] text-white shadow-sm dark:border-white dark:bg-white dark:text-black" : "border-black/[0.08] dark:border-white/11 bg-[var(--surface)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"}`}
        >
          {c.name[locale] ?? c.name.en}
          {c.count ? <span className="ms-1 opacity-60">· {c.count}</span> : null}
        </Link>
      ))}
    </div>
  );
}
