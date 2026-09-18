import "server-only";

/**
 * Validate a post-login redirect target.
 *
 * Only same-site absolute paths are allowed. Anything carrying a scheme, host
 * or protocol-relative prefix is rejected, because `next` arrives from the URL
 * and an unchecked value turns login into an open redirect — a phishing
 * primitive that borrows our domain's credibility.
 *
 * Returns null when the value is unusable, so callers fall back to a default.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > 512) return null;

  // Must be rooted. A single leading slash is not enough: "//evil.com" is
  // protocol-relative in browsers, and "/\evil.com" is treated as "//" by some.
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;

  // A backslash anywhere is normalised to a slash by some clients.
  if (value.includes("\\")) return null;

  // Control characters (including newlines) could smuggle a second target.
  for (const char of value) {
    const code = char.codePointAt(0)!;
    if (code < 0x20 || code === 0x7f) return null;
  }

  return value;
}
