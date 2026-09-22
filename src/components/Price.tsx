"use client";
import { formatPrice, formatDZD } from "@/lib/format";
import { useCurrency } from "@/components/CurrencyProvider";
import type { Locale } from "@/i18n";

export function Price({
  cents,
  locale,
  compareAt,
  size = "md",
}: {
  cents: number;
  locale: Locale;
  compareAt?: number;
  size?: "sm" | "md" | "lg";
}) {
  const { currency, dzdRate, formatAmount } = useCurrency();
  const sizes = {
    sm: "text-sm",
    md: "text-[15px]",
    lg: "text-lg",
  } as const;

  const { primary, secondary } = formatAmount(cents, locale);
  const compareAtText =
    compareAt && compareAt > cents
      ? currency === "DZD"
        ? formatDZD(compareAt, dzdRate, locale)
        : formatPrice(compareAt, locale, "USD")
      : null;

  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className={`font-bold tracking-tight ${sizes[size]}`}>{primary}</span>
      {compareAtText && (
        <span className="text-xs font-medium text-[var(--fg-faint)] line-through">
          {compareAtText}
        </span>
      )}
      <span className="text-[11px] font-medium text-[var(--fg-faint)]">
        {secondary} <span className="font-normal opacity-80">· indicative</span>
      </span>
    </div>
  );
}

export function PriceCompact({ cents, locale }: { cents: number; locale: Locale }) {
  const { formatAmount } = useCurrency();
  const { primary } = formatAmount(cents, locale);
  return <span className="text-sm font-bold tracking-tight">{primary}</span>;
}
