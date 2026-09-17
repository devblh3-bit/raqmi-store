/**
 * Safe rendering of untrusted text for Telegram messages.
 *
 * THREAT MODEL
 * ------------
 * Two classes of string reach admin alerts and are fully or partly
 * attacker-influencable:
 *
 *   1. `delivery` payloads returned by upstream providers (their API, their
 *      strings — we do not control them, and a compromised/hostile provider
 *      can return arbitrary bytes).
 *   2. `customerInput` typed into the storefront by anyone on the internet.
 *
 * If such a string is interpolated into a message sent with `parse_mode:
 * "HTML"` or `"MarkdownV2"`, the attacker controls markup: they can forge
 * bold "VERIFIED" labels, hide text, or - worst - emit
 * `<a href="tg://...">` / `[x](tg://...)` links that an admin taps inside the
 * very chat they trust for operational alerts.
 *
 * STRATEGY: THE SAFE PATH IS THE DEFAULT PATH
 * -------------------------------------------
 * Anything containing provider or customer content is sent with NO parse mode
 * at all. With no parse mode there is no markup grammar to break out of, so
 * escaping cannot be got subtly wrong. `escapeHtml` / `escapeMarkdownV2` exist
 * only for formatting *trusted static* label text, and are typed so that
 * mixing untrusted content into a formatted message is a visible, deliberate
 * act (see `UntrustedText` / `renderPlaintext`).
 *
 * This module is pure and runtime-agnostic (no `server-only`): it is imported
 * by both the Bot API client and the notification builders.
 */

/** Telegram hard limit for a single `sendMessage` text. */
export const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

/** Telegram hard limit for a photo/media caption. */
export const TELEGRAM_MAX_CAPTION_LENGTH = 1024;

/**
 * The complete MarkdownV2 reserved set, per Telegram Bot API docs:
 * `_ * [ ] ( ) ~ ` > # + - = | { } . !`
 * plus the escape character `\` itself, which must be escaped first.
 */
const MARKDOWN_V2_SPECIALS = "_*[]()~`>#+-=|{}.!";

/**
 * Characters that must be neutralised before text is shown to a human,
 * regardless of parse mode, because they lie about the content:
 *  - C0/C1 control characters (except \n and \t, which we keep for layout)
 *  - bidirectional overrides/embeddings (U+202A-202E, U+2066-2069): an
 *    RTL override lets "gpi.moc/evil" render as "evil/com.ipg"
 *  - zero-width and invisible formatting (U+200B-U+200F, U+2060-U+2064,
 *    U+FEFF): used to smuggle payloads past eyeballs and past naive filters,
 *    including ZWJ (U+200D) emoji-splice tricks
 *  - U+2028/U+2029 line/paragraph separators
 */
// eslint-disable-next-line no-control-regex
const INVISIBLE_OR_CONTROL =
  /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

/** URI schemes that are actionable inside a Telegram client. */
const ACTIONABLE_SCHEME = /\b((?:tg|https?|ftp|mailto|tel|data|javascript|file)):\/*/gi;

/**
 * Branded type for text that originated outside our trust boundary.
 * Marking a string `UntrustedText` is documentation *and* a type-level nudge:
 * the formatted-message helpers do not accept it.
 */
export type UntrustedText = string & { readonly __untrusted?: unique symbol };

/** Tag a value as untrusted. Purely a compile-time marker. */
export function untrusted(value: unknown): UntrustedText {
  return coerceToString(value) as UntrustedText;
}

function coerceToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "[unserializable]";
  }
}

/**
 * Escape text for `parse_mode: "HTML"`.
 *
 * Telegram only requires `&`, `<`, `>`; we also escape quotes so the result is
 * safe if it is ever placed inside an attribute (e.g. a trusted
 * `<a href="...">` wrapper) rather than only in a text node.
 *
 * NOTE: escaping is necessary but not sufficient for untrusted content. Prefer
 * plaintext. See module header.
 */
export function escapeHtml(text: string): string {
  return coerceToString(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escape text for `parse_mode: "MarkdownV2"`.
 *
 * Escapes the backslash first (so we never double-consume our own escapes),
 * then every reserved character. Telegram rejects the whole message with
 * "can't parse entities" if even one is missed, so the set is exhaustive.
 */
export function escapeMarkdownV2(text: string): string {
  let out = coerceToString(text).replace(/\\/g, "\\\\");
  for (const ch of MARKDOWN_V2_SPECIALS) {
    out = out.split(ch).join(`\\${ch}`);
  }
  return out;
}

/**
 * Strip invisible/control/bidi characters that misrepresent the text.
 * `\n` and `\t` survive; everything else in the set is dropped.
 */
export function stripInvisible(text: string): string {
  return coerceToString(text).replace(INVISIBLE_OR_CONTROL, "");
}

/**
 * Defang actionable URI schemes so an alert cannot become a one-tap trap.
 * `tg://resolve?domain=x` -> `tg[:]//resolve?domain=x`.
 *
 * The URL remains fully readable for an operator who wants to inspect it, but
 * Telegram will not auto-link it and tapping does nothing.
 */
export function defangUrls(text: string): string {
  return coerceToString(text).replace(ACTIONABLE_SCHEME, (_m, scheme: string) => `${scheme}[:]//`);
}

/**
 * Credential-shaped patterns. Order matters: most specific first, so a bot
 * token is masked as a bot token rather than as a generic long blob.
 *
 * Each entry masks the *secret* portion, keeping the last 4 characters so an
 * operator can correlate with a dashboard without the chat log becoming a
 * credential store.
 */
const CREDENTIAL_PATTERNS: ReadonlyArray<{ re: RegExp; group: number }> = [
  // Telegram bot token: <bot_id>:<35 char secret>
  { re: /\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/g, group: 0 },
  // JWT
  { re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\b/g, group: 0 },
  // key=value / "key": "value" for secret-ish key names
  {
    re: /((?:api[-_]?key|apikey|secret|token|password|passwd|pwd|auth|bearer|credential|private[-_]?key|session|cookie|otp|pin|serial|license|licence|voucher|redeem|code)["'\s]*[:=]\s*["']?)([^\s"',;}&]{4,})/gi,
    group: 2,
  },
  // Bearer header value
  { re: /(Bearer\s+)([A-Za-z0-9._~+/=-]{8,})/gi, group: 2 },
  // Long opaque blobs: hex >= 24, or base64-ish >= 24 with mixed classes
  { re: /\b[0-9a-fA-F]{24,}\b/g, group: 0 },
  { re: /\b(?=[A-Za-z0-9+/=_-]*[A-Z])(?=[A-Za-z0-9+/=_-]*[a-z])(?=[A-Za-z0-9+/=_-]*\d)[A-Za-z0-9+/=_-]{24,}\b/g, group: 0 },
];

/** Mask a secret, keeping at most the last 4 characters. */
export function maskSecret(secret: string, keep = 4): string {
  const s = coerceToString(secret);
  if (s.length <= keep) return "*".repeat(s.length);
  const tail = s.slice(-keep);
  const stars = "*".repeat(Math.min(8, Math.max(3, s.length - keep)));
  return `${stars}${tail}`;
}

/**
 * Mask credential-shaped substrings so a provider `delivery` payload (which
 * legitimately contains redeem codes, serials, account passwords) is not
 * echoed in full into a Telegram chat that lives on admins' phones and in
 * Telegram's cloud backups.
 *
 * Deliberately conservative-by-over-masking: a false positive costs an
 * operator one extra dashboard lookup; a false negative leaks a credential.
 */
export function redactSecretsFromText(text: string): string {
  let out = coerceToString(text);
  for (const { re, group } of CREDENTIAL_PATTERNS) {
    out = out.replace(new RegExp(re.source, re.flags), (match, ...rest) => {
      if (group === 0) return maskSecret(match);
      const prefix = String(rest[group - 2] ?? "");
      const secret = String(rest[group - 1] ?? "");
      return `${prefix}${maskSecret(secret)}`;
    });
  }
  return out;
}

export interface SafePlaintextOptions {
  /** Mask credential-shaped substrings. Default `true`. */
  redactSecrets?: boolean;
  /** Defang actionable URI schemes. Default `true`. */
  defang?: boolean;
  /** Collapse runs of newlines to at most 2, and trim. Default `true`. */
  collapseWhitespace?: boolean;
  /** Hard cap on the produced length. Default `TELEGRAM_MAX_MESSAGE_LENGTH`. */
  maxLength?: number;
}

/**
 * THE function to run every untrusted string through.
 *
 * Produces plaintext that is safe to send with **no parse mode**:
 *  - invisible/control/bidi characters removed
 *  - credential-shaped substrings masked
 *  - actionable URI schemes defanged
 *  - length bounded on a safe boundary
 *
 * It does NOT escape HTML/Markdown, because the output is not destined for a
 * parser. Escaping here would only produce `&amp;lt;` noise in the chat.
 */
export function toSafePlaintext(value: unknown, options: SafePlaintextOptions = {}): string {
  const {
    redactSecrets = true,
    defang = true,
    collapseWhitespace = true,
    maxLength = TELEGRAM_MAX_MESSAGE_LENGTH,
  } = options;

  let out = coerceToString(value);
  // Normalise first: NFC folds compatibility forms so lookalike sequences do
  // not slip past the invisible-character filter.
  try {
    out = out.normalize("NFC");
  } catch {
    /* invalid surrogates: fall through with the raw string */
  }
  out = stripInvisible(out);
  if (redactSecrets) out = redactSecretsFromText(out);
  if (defang) out = defangUrls(out);
  if (collapseWhitespace) {
    out = out.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }
  return truncateForTelegram(out, { limit: maxLength });
}

export interface TruncateOptions {
  limit?: number;
  /**
   * Which escape grammar the input is already written in. Truncation will not
   * cut inside an `&amp;` entity (`"html"`) or after a lone `\` (`"markdown"`).
   * Default `"plain"`, which still respects surrogate pairs.
   */
  mode?: "plain" | "html" | "markdown";
  /** Marker appended when text was cut. Default `" [...]"`. */
  ellipsis?: string;
}

/**
 * Truncate to Telegram's limit, breaking on the last safe boundary
 * (paragraph > line > sentence > space) instead of mid-word, and never inside
 * a surrogate pair, an HTML entity, or a MarkdownV2 escape sequence.
 */
export function truncateForTelegram(text: string, options: TruncateOptions = {}): string {
  const { limit = TELEGRAM_MAX_MESSAGE_LENGTH, mode = "plain", ellipsis = " [...]" } = options;
  const s = coerceToString(text);
  if (limit <= 0) return "";
  if ([...s].length <= limit && s.length <= limit) return s;

  const budget = Math.max(0, limit - ellipsis.length);
  if (budget === 0) return ellipsis.slice(0, limit);

  let cut = s.slice(0, budget);

  // Prefer a natural boundary if one exists reasonably close to the end.
  const boundary = Math.max(
    cut.lastIndexOf("\n\n"),
    cut.lastIndexOf("\n"),
    cut.lastIndexOf(". "),
    cut.lastIndexOf(" "),
  );
  if (boundary > budget * 0.6) cut = cut.slice(0, boundary);

  cut = trimUnsafeTail(cut, mode);
  return `${cut.replace(/\s+$/, "")}${ellipsis}`;
}

/**
 * Split long text into Telegram-sized chunks, preferring paragraph then line
 * boundaries. Each chunk is independently safe to send.
 */
export function splitForTelegram(
  text: string,
  options: { limit?: number; mode?: TruncateOptions["mode"] } = {},
): string[] {
  const { limit = TELEGRAM_MAX_MESSAGE_LENGTH, mode = "plain" } = options;
  const s = coerceToString(text);
  if (limit <= 0) return [];
  if (s.length <= limit) return s.length ? [s] : [];

  const chunks: string[] = [];
  let rest = s;
  while (rest.length > limit) {
    let cut = rest.slice(0, limit);
    const boundary = Math.max(cut.lastIndexOf("\n\n"), cut.lastIndexOf("\n"), cut.lastIndexOf(" "));
    if (boundary > limit * 0.5) cut = cut.slice(0, boundary);
    cut = trimUnsafeTail(cut, mode);
    if (!cut.length) cut = rest.slice(0, limit); // pathological: no boundary at all
    chunks.push(cut.replace(/\s+$/, ""));
    rest = rest.slice(cut.length).replace(/^\s+/, "");
  }
  if (rest.length) chunks.push(rest);
  return chunks;
}

/**
 * Pull back the cut point until it cannot be inside a multi-unit sequence:
 * a UTF-16 surrogate pair, an HTML entity (`&amp;`), or a MarkdownV2 escape
 * (`\.`). Bounded to a short scan so it cannot become a hot loop.
 */
function trimUnsafeTail(cut: string, mode: TruncateOptions["mode"]): string {
  let out = cut;

  // Never end on a high surrogate whose pair we just dropped.
  if (out.length) {
    const last = out.charCodeAt(out.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) out = out.slice(0, -1);
  }

  if (mode === "html") {
    // A trailing partial entity: "&", "&am", "&#3" ...
    const partial = out.match(/&[#A-Za-z0-9]{0,10}$/);
    if (partial && !/;$/.test(partial[0])) out = out.slice(0, out.length - partial[0].length);
  }

  if (mode === "markdown") {
    // A trailing odd run of backslashes would escape the ellipsis marker.
    const trailing = out.match(/\\+$/);
    if (trailing && trailing[0].length % 2 === 1) out = out.slice(0, -1);
  }

  return out;
}

/** A single labelled line in a plaintext alert. */
export interface PlaintextField {
  /** Trusted static label written by us. */
  label: string;
  /** Any value; treated as untrusted and sanitised. */
  value: unknown;
  /** Skip the line entirely when the value is empty. Default `true`. */
  omitIfEmpty?: boolean;
}

export interface PlaintextMessage {
  /** Trusted static title written by us. */
  title: string;
  fields?: PlaintextField[];
  /** Free-form trailing lines; each is sanitised as untrusted. */
  notes?: unknown[];
  limit?: number;
}

/**
 * Build a complete plaintext alert body.
 *
 * Labels/title are trusted static strings; every value goes through
 * `toSafePlaintext`. The result carries no markup and must be sent with no
 * `parse_mode` - which is exactly what `sendSafePlaintext` does.
 */
export function renderPlaintext(message: PlaintextMessage): string {
  const limit = message.limit ?? TELEGRAM_MAX_MESSAGE_LENGTH;
  const lines: string[] = [stripInvisible(message.title).trim()];

  for (const field of message.fields ?? []) {
    const value = toSafePlaintext(field.value, { maxLength: 512 });
    if (!value && (field.omitIfEmpty ?? true)) continue;
    lines.push(`${stripInvisible(field.label).trim()}: ${value}`);
  }

  const notes = (message.notes ?? [])
    .map((n) => toSafePlaintext(n, { maxLength: 1024 }))
    .filter(Boolean);
  if (notes.length) lines.push("", ...notes);

  return truncateForTelegram(lines.join("\n"), { limit, mode: "plain" });
}

/**
 * Formatted-message builder for **trusted static text only**.
 *
 * The parameter type excludes `UntrustedText`, so passing a provider or
 * customer string is a type error rather than a silent injection. If you
 * genuinely need to show untrusted content, send it as plaintext.
 */
export function renderTrustedHtml(parts: ReadonlyArray<Exclude<string, UntrustedText>>): string {
  return truncateForTelegram(parts.join(""), { mode: "html" });
}
