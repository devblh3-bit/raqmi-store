import Link from "next/link";

export default function SectionHeader({
  title,
  subtitle,
  href,
  cta,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-[var(--fg-muted)]">{subtitle}</p>}
      </div>
      {href && cta && (
        <Link
          href={href}
          className="shrink-0 rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold shadow-sm transition-all hover:shadow-md"
        >
          {cta} →
        </Link>
      )}
    </div>
  );
}
