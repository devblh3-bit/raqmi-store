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
        {subtitle && <p className="mt-1 text-sm tracking-tight text-[var(--fg-muted)]">{subtitle}</p>}
      </div>
      {href && cta && (
        <Link
          href={href}
          className="mat-func group inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold tracking-tight text-[var(--fg)] shadow-sm transition-all duration-300 ease-[var(--ease-premium)] hover:shadow-md active:scale-[0.98]"
        >
          {cta}
          <span aria-hidden className="transition-transform duration-300 ease-[var(--ease-premium)] group-hover:translate-x-0.5">→</span>
        </Link>
      )}
    </div>
  );
}
