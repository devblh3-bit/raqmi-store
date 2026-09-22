/**
 * Lightweight digital store translation helper.
 * Translates common gaming, gift card, and subscription titles/terms into Arabic and French.
 */

const DICTIONARY: Record<string, { ar: string; fr: string }> = {
  // Common Units / Denominations
  diamonds: { ar: "مجوهرات", fr: "Diamants" },
  diamond: { ar: "جوهرة", fr: "Diamant" },
  coins: { ar: "عملات", fr: "Pièces" },
  coin: { ar: "عملة", fr: "Pièce" },
  points: { ar: "نقاط", fr: "Points" },
  point: { ar: "نقطة", fr: "Point" },
  gems: { ar: "جواهر", fr: "Gemmes" },
  gem: { ar: "جوهرة", fr: "Gemme" },
  credits: { ar: "رصيد", fr: "Crédits" },
  credit: { ar: "رصيد", fr: "Crédit" },
  uc: { ar: "يو سي", fr: "UC" },
  cp: { ar: "سي بي", fr: "CP" },
  robux: { ar: "روبوكس", fr: "Robux" },
  vbucks: { ar: "في بوكس", fr: "V-Bucks" },
  "v-bucks": { ar: "في بوكس", fr: "V-Bucks" },

  // Products & Categories
  "gift card": { ar: "بطاقة هدايا", fr: "Carte Cadeau" },
  "gift cards": { ar: "بطاقات هدايا", fr: "Cartes Cadeaux" },
  card: { ar: "بطاقة", fr: "Carte" },
  voucher: { ar: "قسيمة", fr: "Bon d'achat" },
  subscription: { ar: "اشتراك", fr: "Abonnement" },
  membership: { ar: "عضوية", fr: "Adhésion" },
  pass: { ar: "بطاقة مرور", fr: "Passe" },
  "battle pass": { ar: "باتل باس", fr: "Passe de combat" },

  // Durations
  month: { ar: "شهر", fr: "Mois" },
  months: { ar: "أشهر", fr: "Mois" },
  "1 month": { ar: "شهر واحد", fr: "1 Mois" },
  "3 months": { ar: "3 أشهر", fr: "3 Mois" },
  "6 months": { ar: "6 أشهر", fr: "6 Mois" },
  "12 months": { ar: "12 شهر", fr: "12 Mois" },
  year: { ar: "سنة", fr: "An" },
  years: { ar: "سنوات", fr: "Ans" },
  "1 year": { ar: "سنة واحدة", fr: "1 An" },
  week: { ar: "أسبوع", fr: "Semaine" },
  weeks: { ar: "أسابيع", fr: "Semaines" },
  day: { ar: "يوم", fr: "Jour" },
  days: { ar: "أيام", fr: "Jours" },
  lifetime: { ar: "مدى الحياة", fr: "À vie" },

  // Tiers & Attributes
  premium: { ar: "بريميوم", fr: "Premium" },
  standard: { ar: "قياسي", fr: "Standard" },
  basic: { ar: "أساسي", fr: "Basique" },
  ultimate: { ar: "التيميت", fr: "Ultime" },
  plus: { ar: "بلس", fr: "Plus" },
  pro: { ar: "برو", fr: "Pro" },
  global: { ar: "عالمي", fr: "Global" },
  direct: { ar: "مباشر", fr: "Direct" },
  topup: { ar: "شحن", fr: "Recharge" },
  "top-up": { ar: "شحن", fr: "Recharge" },
  "instant delivery": { ar: "تسليم فوري", fr: "Livraison instantanée" },
  instant: { ar: "فوري", fr: "Instantané" },
  fast: { ar: "سريع", fr: "Rapide" },
  digital: { ar: "رقمي", fr: "Numérique" },
  code: { ar: "كود", fr: "Code" },
};

/**
 * Translates English text into Arabic and French using digital store heuristics.
 */
export function autoTranslateStoreText(englishText: string): { ar: string; fr: string } {
  const trimmed = englishText.trim();
  if (!trimmed) return { ar: "", fr: "" };

  const lower = trimmed.toLowerCase();

  // 1. Direct exact phrase match
  if (DICTIONARY[lower]) {
    return {
      ar: DICTIONARY[lower].ar,
      fr: DICTIONARY[lower].fr,
    };
  }

  // 2. Tokenized replacement
  let arResult = trimmed;
  let frResult = trimmed;

  // Sort dictionary keys by length descending to match multi-word phrases first
  const keys = Object.keys(DICTIONARY).sort((a, b) => b.length - a.length);

  for (const key of keys) {
    const regex = new RegExp(`\\b${key}\\b`, "gi");
    if (regex.test(arResult)) {
      arResult = arResult.replace(regex, DICTIONARY[key].ar);
    }
    if (regex.test(frResult)) {
      frResult = frResult.replace(regex, DICTIONARY[key].fr);
    }
  }

  return {
    ar: arResult,
    fr: frResult,
  };
}

/**
 * Strips Telegram custom emoji tags and HTML break tags from supplier descriptions
 * while preserving natural emoji unicode, newlines, and bullet points.
 */
export function cleanProviderDescription(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/<tg-emoji[^>]*>(.*?)<\/tg-emoji>/gi, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<p>/gi, "")
    .replace(/<\/p>/gi, "\n")
    .trim();
}

