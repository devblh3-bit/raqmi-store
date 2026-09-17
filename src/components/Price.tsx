"use client";
import { formatPrice, formatDZD } from "@/lib/format";
import type { Locale } from "@/i18n";

const FX_DZD = 135; // indicative, admin-editable later

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
  const sizes = {
    sm: "text-sm",
    md: "text-[15px]",
    lg: "text-lg",
  } as const;
  const dzd = formatDZD(cents, FX_DZD, locale);
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className={`font-bold tracking-tight ${sizes[size]}`}>{formatPrice(cents, locale)}</span>
      {compareAt && compareAt > cents && (
        <span className="text-xs font-medium text-[var(--fg-faint)] line-through">
          {formatPrice(compareAt, locale)}
        </span>
      )}
      <span className="text-[11px] font-medium text-[var(--fg-faint)]">
        ≈ {dzd} <span className="font-normal">· indicative</span>
      </span>
    </div>
  );
}

export function PriceCompact({ cents, locale }: { cents: number; locale: Locale }) {
  return <span className="text-sm font-bold tracking-tight">{formatPrice(cents, locale)}</span>;
}
