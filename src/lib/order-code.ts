/**
 * High-entropy order codes. This code is the guest-lookup credential: it must
 * resist enumeration, so it comes from node:crypto.randomBytes (CSPRNG), never
 * from Math.random or short hex.
 *
 * Format: `RQM-` + 20 data chars + 1 check char, all Crockford base32
 * (alphabet 0-9 A-Z minus I/L/O/U — unambiguous, excludes confusables).
 *
 * Entropy: 20 chars * log2(32) = 100 bits. At 1e9 guesses/sec, brute-forcing a
 * single code takes ~4e13 years. The check char is derived (not random), so the
 * credential entropy stays 100 bits.
 *
 * Check character: sum(d_i * (2i+1)) mod 32 over the 20 data chars, where d_i is
 * the symbol value. Weights are odd, so any single-character substitution changes
 * the sum by delta*w with 32 not dividing delta*w — every single-char typo is
 * detected before a DB lookup. (Adjacent transpositions are not all caught; ponytail:
 * upgrade to a mod-37 Crockford check with '*' if that ever matters.)
 */
import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const BASE = ALPHABET.length; // 32
const DATA_LEN = 20;
const PREFIX = "RQM-";

/** Visually-confusable input → Crockford (per spec: O→0, I/L→1). U is excluded by Crockford. */
const CONFUSABLES: Record<string, string> = { O: "0", I: "1", L: "1" };

function randomSymbol(): number {
  // Rejection sampling for a uniform draw (no modulo bias). For base 32 with a
  // byte source the rejection branch never fires (32 | 256), but the loop keeps
  // it correct for any alphabet change.
  for (;;) {
    const b = randomBytes(1)[0];
    if (b < 256 - (256 % BASE)) return b % BASE;
  }
}

function checkChar(data: string): string {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = ALPHABET.indexOf(data[i]);
    if (v < 0) throw new Error("checkChar: non-Crockford character");
    sum += v * (2 * i + 1);
  }
  return ALPHABET[sum % BASE];
}

export function generateOrderCode(): string {
  let data = "";
  for (let i = 0; i < DATA_LEN; i++) data += ALPHABET[randomSymbol()];
  return PREFIX + data + checkChar(data);
}

/**
 * Normalize user input: uppercase, strip spaces/hyphens/dots, map confusables
 * (0/O, 1/I/L). Accepts the code with or without the `RQM-` prefix.
 * Returns the canonical `RQM-<20 data><1 check>` form, or null if the input
 * contains characters that cannot be part of a code or has the wrong length.
 */
export function normalizeOrderCode(input: string): string | null {
  if (typeof input !== "string") return null;
  let s = input.toUpperCase().replace(/[\s.\-]/g, "");
  if (s.startsWith("RQM")) s = s.slice(3);
  let out = "";
  for (const ch of s) {
    const c = CONFUSABLES[ch] ?? ch;
    if (!ALPHABET.includes(c)) return null;
    out += c;
  }
  if (out.length !== DATA_LEN + 1) return null;
  return PREFIX + out;
}

/** Strict format + checksum validation. Typos are caught here, before any DB lookup. */
export function isValidOrderCodeFormat(s: string): boolean {
  const norm = normalizeOrderCode(s);
  if (norm === null) return false;
  const body = norm.slice(PREFIX.length);
  const data = body.slice(0, DATA_LEN);
  return checkChar(data) === body[DATA_LEN];
}
