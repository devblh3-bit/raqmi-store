/**
 * Utility to parse and format raw provider/offer titles into clean,
 * customer-friendly presentations with separated feature badges.
 */

export interface FormattedVariant {
  title: string;
  tags: string[];
}

export function formatVariantTitle(raw: string): FormattedVariant {
  if (!raw || typeof raw !== "string") {
    return { title: "", tags: [] };
  }

  let cleaned = raw.trim();
  const tags: string[] = [];

  // Extract parenthesized notes e.g. "(Full Warranty)", "(Add Slot)", "(Invite Link)"
  const parenMatches = cleaned.match(/\(([^)]+)\)/g);
  if (parenMatches) {
    for (const match of parenMatches) {
      const inner = match.slice(1, -1).trim();
      // Split if comma or hyphen separated inside parentheses
      const subParts = inner.split(/[,،-]/).map((s) => s.trim()).filter(Boolean);
      for (const part of subParts) {
        // Skip raw supplier junk codes
        if (/^KBH$/i.test(part)) continue;
        if (!tags.includes(part)) {
          tags.push(part);
        }
      }
      cleaned = cleaned.replace(match, "").trim();
    }
  }

  // Clean trailing hyphens or commas left behind
  cleaned = cleaned.replace(/[-–—,،\s]+$/, "").trim();

  // Clean up all-caps acronyms like "18M LINK" -> "18 Months Link"
  cleaned = cleaned.replace(/\b(\d+)\s*M\s+LINK\b/i, "$1 Months Link");
  cleaned = cleaned.replace(/\b18M\b/i, "18 Months");
  cleaned = cleaned.replace(/\b12M\b/i, "12 Months");
  cleaned = cleaned.replace(/\b6M\b/i, "6 Months");
  cleaned = cleaned.replace(/\b3M\b/i, "3 Months");
  cleaned = cleaned.replace(/\b1M\b/i, "1 Month");

  // Normalize excessive spaces
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  return {
    title: cleaned || raw,
    tags,
  };
}
