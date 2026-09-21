/**
 * Dedupe key derivation for Offer rows.
 *
 * A dedupe key is the canonical identity an Offer keeps when an admin pins it
 * (`productPinned`). A future auto-grouping step would match incoming provider
 * offers by this key; pinned offers are skipped. For now the only consumer is
 * seed backfill and any admin curation that explicitly sets `dedupeKey`.
 */

export function dedupeKeyForOffer(
  input: { labelEn: string; productSlug?: string },
): string {
  const raw = `${input.productSlug ?? ""}::${input.labelEn}`.toLowerCase();
  // collapse whitespace, strip punctuation, keep a stable short key.
  return raw
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}
