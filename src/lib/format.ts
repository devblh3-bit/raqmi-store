export function formatPrice(cents: number, locale: string, currency = "USD") {
  // Show USD primary, with DZD secondary handled by Price component
  return new Intl.NumberFormat(locale === "ar" ? "en-US" : locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatDZD(usdCents: number, fxRate: number, locale: string) {
  const dzd = Math.round((usdCents / 100) * fxRate);
  return new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
    style: "currency",
    currency: "DZD",
    maximumFractionDigits: 0,
  }).format(dzd);
}
