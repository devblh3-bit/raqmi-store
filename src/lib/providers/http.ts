import "server-only";
import { z } from "zod";
import type { NormalizedError, NormalizedErrorKind } from "./types";
import { fail, ok, type Result } from "./types";

/* ------------------------------------------------------------------ redact */

/**
 * Known provider key prefixes. Matched with a generous tail so a partially
 * copied key is still scrubbed.
 */
const KEY_PREFIXES = ["qcst_live_", "vbr_live_", "tgb_"] as const;

const KEY_PREFIX_RE = new RegExp(`(${KEY_PREFIXES.join("|")})[A-Za-z0-9_\\-]*`, "gi");

/** Field names whose *values* are always secret. */
const SECRET_FIELD_RE =
  /^(key|apikey|api_key|token|access_token|refresh_token|secret|authorization|password|pass|reseller_key|idempotency_key)$/i;

/** `key=...` / `token=...` inside a query string or a header dump. */
const QUERY_SECRET_RE =
  /\b(key|apikey|api_key|token|access_token|secret|authorization|password|reseller_key)(=|["']?\s*[:=]\s*["']?)([^\s&"',}]+)/gi;

const REDACTED = "[REDACTED]";

/**
 * Strip secrets from anything that may reach a log, an error message, or a
 * thrown value. Safe on cyclic structures. Used on every log/error path.
 */
export function redact<T>(input: T): T {
  return redactValue(input, new WeakSet()) as T;
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return redactString(value);
  if (value === null || typeof value !== "object") return value;

  if (seen.has(value as object)) return "[Circular]";
  seen.add(value as object);

  if (Array.isArray(value)) return value.map((v) => redactValue(v, seen));

  if (value instanceof Error) {
    const clone = new Error(redactString(value.message));
    clone.name = value.name;
    return clone;
  }

  if (value instanceof Headers) {
    const out: Record<string, string> = {};
    value.forEach((v, k) => {
      out[k] = SECRET_FIELD_RE.test(k) || /^x-(api|reseller)-key$/i.test(k)
        ? REDACTED
        : redactString(v);
    });
    return out;
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_FIELD_RE.test(k) || /^x-(api|reseller)-key$/i.test(k)) {
      out[k] = REDACTED;
    } else {
      out[k] = redactValue(v, seen);
    }
  }
  return out;
}

function redactString(s: string): string {
  return s.replace(KEY_PREFIX_RE, REDACTED).replace(
    QUERY_SECRET_RE,
    (_m, name: string, sep: string) => `${name}${sep}${REDACTED}`,
  );
}

/** Console logger that redacts every argument. Adapters log only through this. */
export function safeLog(
  level: "warn" | "error",
  message: string,
  meta?: unknown,
): void {
  const line = `[providers] ${redactString(message)}`;
  if (meta === undefined) console[level](line);
  else console[level](line, redact(meta));
}

/* -------------------------------------------------------------- SSRF guard */

/**
 * Hostname allowlist, pinned in code. Base URLs are NOT configurable from the
 * database or from env, so a compromised DB row cannot redirect provider
 * traffic to an attacker-controlled host.
 */
export const ALLOWED_HOSTS = Object.freeze([
  "api.qcst.tech",
  "ventetelegrambotrailway-production.up.railway.app",
  "canboso.com",
]);

const PRIVATE_IPV4 =
  /^(0|10|127)\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\.|^192\.168\.|^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./;

function isIpLiteralBlocked(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  // IPv6 loopback / link-local / unique-local / v4-mapped
  if (host.includes(":")) {
    if (host === "::1" || host === "::") return true;
    if (/^fe80:/.test(host)) return true;
    if (/^f[cd][0-9a-f]{2}:/.test(host)) return true;
    if (/^::ffff:/.test(host)) return true;
    return false;
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return PRIVATE_IPV4.test(host);
  // Decimal / hex / octal IPv4 shorthand, e.g. http://2130706433/
  if (/^(\d+|0x[0-9a-f]+)$/.test(host)) return true;
  return false;
}

export class SsrfBlockedError extends Error {
  constructor(readonly host: string) {
    super(`Blocked non-allowlisted provider host: ${host}`);
    this.name = "SsrfBlockedError";
  }
}

/**
 * Validate a URL against the allowlist. Throws SsrfBlockedError, which
 * `request()` converts into a `kind: "provider"` normalized error.
 */
export function assertAllowedUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError(rawUrl);
  }
  if (url.protocol !== "https:") throw new SsrfBlockedError(url.protocol);
  if (isIpLiteralBlocked(url.hostname)) throw new SsrfBlockedError(url.hostname);
  if (!ALLOWED_HOSTS.includes(url.hostname.toLowerCase())) {
    throw new SsrfBlockedError(url.hostname);
  }
  return url;
}

/* ------------------------------------------------------- error normalizing */

export function statusToKind(status: number): NormalizedErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 422 || status === 400) return "validation";
  if (status === 429) return "rate_limited";
  return "provider";
}

/**
 * `Retry-After` is seconds or an HTTP date (RFC 9110). Returns ms, clamped.
 */
export function parseRetryAfter(
  header: string | null,
  now = Date.now(),
): number | undefined {
  if (!header) return undefined;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) return clampRetry(Number(trimmed) * 1000);
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return undefined;
  return clampRetry(at - now);
}

const MAX_RETRY_AFTER_MS = 6 * 60 * 60 * 1000; // Canboso penalty level 5

function clampRetry(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.min(Math.round(ms), MAX_RETRY_AFTER_MS);
}

export function networkError(message: string, retryable = true): NormalizedError {
  return { kind: "network", retryable, message: redactString(message) };
}

export function validationError(
  message: string,
  extra?: Partial<NormalizedError>,
): NormalizedError {
  return {
    kind: "validation",
    retryable: false,
    message: redactString(message),
    ...extra,
  };
}

/**
 * Parse an unknown provider payload with a zod schema, returning a normalized
 * validation error instead of throwing. Zod issue paths are included; raw
 * values are not, so payload contents cannot leak a secret into a message.
 */
export function parseWith<S extends z.ZodType>(
  schema: S,
  data: unknown,
  what: string,
): Result<z.output<S>> {
  const parsed = schema.safeParse(data);
  if (parsed.success) return ok(parsed.data);
  const issues = parsed.error.issues
    .slice(0, 6)
    .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
    .join("; ");
  return fail(
    validationError(`Invalid ${what} response from provider (${issues})`),
  );
}

/* ------------------------------------------------------------------ request */

export interface RequestOptions {
  method?: "GET" | "POST";
  url: string;
  headers?: Record<string, string>;
  json?: unknown;
  /** Per-attempt timeout. */
  timeoutMs?: number;
  /** Extra attempts after the first. Only idempotent-safe calls should retry. */
  maxRetries?: number;
  /** Treat these statuses as success and hand them to the caller (VBR 304). */
  passthroughStatuses?: number[];
  /** Maps a provider error body into a NormalizedError. */
  mapError: (ctx: ProviderErrorContext) => NormalizedError;
  signal?: AbortSignal;
}

export interface ProviderErrorContext {
  status: number;
  /** Parsed JSON body, or undefined when the body was not JSON. */
  body: unknown;
  /** Raw body text, truncated and redacted. */
  text: string;
  headers: Headers;
  retryAfterMs?: number;
  kind: NormalizedErrorKind;
}

export interface HttpResponse {
  status: number;
  headers: Headers;
  /** Parsed JSON, or undefined for 304 / empty bodies. */
  body: unknown;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 400;
const MAX_BACKOFF_MS = 8_000;
/** Never sleep longer than this inside one request() call. */
export const MAX_SLEEP_PER_ATTEMPT_MS = 30_000;

function backoffMs(attempt: number): number {
  const expo = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  return Math.round(expo * (0.5 + Math.random() * 0.5)); // full-ish jitter
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Single entry point for all provider traffic.
 *
 * Guarantees:
 *  - host allowlist enforced before any socket is opened;
 *  - per-attempt timeout via AbortController;
 *  - retries only on 429/5xx/network, with exponential backoff + jitter,
 *    and never more than `maxRetries` extra attempts (no tight loop);
 *  - a 429 whose Retry-After exceeds our sleep budget is returned to the
 *    caller with `retryAfterMs` set instead of being slept through;
 *  - 409 is never retried (the caller reconciles by clientOrderId);
 *  - the response body is `unknown`; validation is the adapter's job.
 */
export async function request(opts: RequestOptions): Promise<Result<HttpResponse>> {
  let url: URL;
  try {
    url = assertAllowedUrl(opts.url);
  } catch (e) {
    const host = e instanceof SsrfBlockedError ? e.host : "unknown";
    return fail({
      kind: "provider",
      retryable: false,
      message: `Refusing request to non-allowlisted host: ${redactString(String(host))}`,
    });
  }

  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const passthrough = new Set(opts.passthroughStatuses ?? []);

  let lastError: NormalizedError = networkError("No attempt was made");

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const wait = lastError.retryAfterMs ?? backoffMs(attempt - 1);
      await sleep(Math.min(wait, MAX_SLEEP_PER_ATTEMPT_MS));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onOuterAbort = () => controller.abort();
    opts.signal?.addEventListener("abort", onOuterAbort, { once: true });

    let res: Response;
    try {
      const headers: Record<string, string> = { accept: "application/json", ...opts.headers };
      let body: string | undefined;
      if (opts.json !== undefined) {
        body = JSON.stringify(opts.json);
        headers["content-type"] = "application/json";
      }
      res = await fetch(url.toString(), {
        method: opts.method ?? "GET",
        headers,
        body,
        signal: controller.signal,
        redirect: "error", // a redirect could leave the allowlisted host
        cache: "no-store",
      });
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      lastError = networkError(
        aborted
          ? `Provider request timed out after ${timeoutMs}ms`
          : `Provider request failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onOuterAbort);
    }

    const status = res.status;

    if (res.ok || passthrough.has(status)) {
      let parsed: unknown;
      if (status !== 304 && status !== 204) {
        const text = await res.text().catch(() => "");
        if (text.trim() !== "") {
          try {
            parsed = JSON.parse(text);
          } catch {
            return fail(
              validationError("Provider returned a non-JSON success body", { status }),
            );
          }
        }
      }
      return ok({ status, headers: res.headers, body: parsed });
    }

    const rawText = await res.text().catch(() => "");
    let parsedBody: unknown;
    try {
      parsedBody = rawText.trim() === "" ? undefined : JSON.parse(rawText);
    } catch {
      parsedBody = undefined;
    }

    const retryAfterMs = parseRetryAfter(res.headers.get("retry-after"));
    lastError = opts.mapError({
      status,
      body: parsedBody,
      text: redactString(rawText.slice(0, 500)),
      headers: res.headers,
      retryAfterMs,
      kind: statusToKind(status),
    });

    // 409 must never be retried with a new key: the caller reconciles instead.
    if (status === 409) return fail(lastError);
    if (!lastError.retryable) return fail(lastError);

    // Honour a long Retry-After by handing control back rather than sleeping.
    if (
      lastError.retryAfterMs !== undefined &&
      lastError.retryAfterMs > MAX_SLEEP_PER_ATTEMPT_MS
    ) {
      return fail(lastError);
    }
  }

  return fail(lastError);
}

/** Read an env secret. Never reads NEXT_PUBLIC_*; never logs the value. */
export function requireEnvKey(name: string): Result<string> {
  if (name.startsWith("NEXT_PUBLIC_")) {
    return fail({
      kind: "auth",
      retryable: false,
      message: `Refusing to read client-exposed env var ${name}`,
    });
  }
  const value = process.env[name];
  if (!value || value.trim() === "") {
    return fail({
      kind: "auth",
      retryable: false,
      message: `Missing provider credential: ${name} is not configured`,
    });
  }
  return ok(value.trim());
}
