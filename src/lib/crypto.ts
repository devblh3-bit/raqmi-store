/**
 * Envelope encryption for PII / delivery payloads.
 *
 * Serialized format (self-describing, versioned):
 *   v{keyVersion}.{base64url(salt)}.{base64url(nonce)}.{base64url(ciphertext)}.{base64url(tag)}
 *
 * - AES-256-GCM, fresh random 12-byte nonce per encryption (never reused), 16-byte tag.
 * - AAD = `${recordId}:${fieldName}` — binds ciphertext to its row+field, so
 *   ciphertext swapped between rows or columns fails authentication.
 * - KEK→DEK: ENCRYPTION_KEY is the KEK (32 raw bytes as base64, or 64-char hex).
 *   Per-record DEK is derived via HKDF-SHA256 with a random per-record salt, so
 *   one leaked DEK compromises only that record.
 * - Key rotation: set ENCRYPTION_KEY to the new KEK and keep old ones as
 *   ENCRYPTION_KEY_V{olderVersion}. decrypt() reads keyVersion from the payload
 *   and picks the right KEK; new writes use ENCRYPTION_KEY (the current
 *   version). Re-encrypt rows with reEncryptField, then drop the old vars and
 *   set ENCRYPTION_KEY_VERSION to pin the current version (otherwise it is
 *   derived as max(ENCRYPTION_KEY_V*)+1 and dropping old vars would renumber it).
 *
 * Never logs plaintext, keys, or ciphertext. All errors are generic.
 */
import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const SALT_LEN = 16;
const NONCE_LEN = 12;
const KEY_LEN = 32;
const HKDF_INFO = Buffer.from("rqm:field-encryption:v1");
const MAX_VERSION = 1_000_000;

type Kek = { version: number; key: Buffer };

let kekCache: { current: Kek; older: Map<number, Kek> } | null = null;

function parseKek(raw: string): Buffer {
  const s = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(s)) return Buffer.from(s, "hex");
  const b64 = Buffer.from(s, "base64");
  if (b64.length === KEY_LEN) return b64;
  throw new Error(
    "ENCRYPTION_KEY must be 32 bytes as base64 or 64 hex chars",
  );
}

/** Lazy + memoized so tests can rotate env vars; fails loudly on malformed keys. */
function keys(): { current: Kek; older: Map<number, Kek> } {
  if (kekCache) return kekCache;
  const env = process.env;
  const rawCurrent = env.ENCRYPTION_KEY;
  if (!rawCurrent) {
    throw new Error(
      'ENCRYPTION_KEY is missing. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }
  const older = new Map<number, Kek>();
  // Current version = highest present. ENCRYPTION_KEY is current; ENCRYPTION_KEY_V{n} are older.
  let currentVersion = 1;
  for (const name of Object.keys(env)) {
    const m = /^ENCRYPTION_KEY_V(\d+)$/.exec(name);
    if (!m || !env[name]) continue;
    const v = Number(m[1]);
    if (v > MAX_VERSION) throw new Error(`invalid key version in ${name}`);
    if (v >= currentVersion) currentVersion = v + 1;
    older.set(v, { version: v, key: parseKek(env[name] as string) });
  }
  // Explicit pin wins: after re-encrypting and dropping old ENCRYPTION_KEY_V* vars,
  // ENCRYPTION_KEY_VERSION keeps the current version stable instead of renumbering to 1.
  if (env.ENCRYPTION_KEY_VERSION) {
    const pinned = Number(env.ENCRYPTION_KEY_VERSION);
    if (!Number.isInteger(pinned) || pinned < 1 || pinned > MAX_VERSION || pinned <= Math.max(0, ...older.keys())) {
      throw new Error("invalid ENCRYPTION_KEY_VERSION");
    }
    currentVersion = pinned;
  }
  kekCache = { current: { version: currentVersion, key: parseKek(rawCurrent) }, older };
  return kekCache;
}

/** Test-only: drop the memoized keys so env changes take effect. */
export function _resetKeyCacheForTests(): void {
  kekCache = null;
}

function deriveDek(kek: Buffer, salt: Buffer): Buffer {
  return Buffer.from(hkdfSync("sha256", kek, salt, HKDF_INFO, KEY_LEN));
}

function aad(recordId: string, fieldName: string): Buffer {
  return Buffer.from(`${recordId}:${fieldName}`);
}

export function currentKeyVersion(): number {
  return keys().current.version;
}

export function encryptField(opts: {
  recordId: string;
  fieldName: string;
  plaintext: string;
}): string {
  const { recordId, fieldName, plaintext } = opts;
  const { current } = keys();
  const salt = randomBytes(SALT_LEN);
  const nonce = randomBytes(NONCE_LEN);
  const dek = deriveDek(current.key, salt);
  const cipher = createCipheriv("aes-256-gcm", dek, nonce);
  cipher.setAAD(aad(recordId, fieldName));
  const ct = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    `v${current.version}`,
    salt.toString("base64url"),
    nonce.toString("base64url"),
    ct.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

function parsePayload(
  payload: string,
): { version: number; salt: Buffer; nonce: Buffer; ct: Buffer; tag: Buffer } {
  const parts = payload.split(".");
  if (parts.length !== 5) throw new Error("malformed encrypted payload");
  const vm = /^v(\d+)$/.exec(parts[0] as string);
  if (!vm) throw new Error("malformed encrypted payload");
  const version = Number(vm[1]);
  if (version < 1 || version > MAX_VERSION) throw new Error("unknown key version");
  const [salt, nonce, ct, tag] = [1, 2, 3, 4].map((i) =>
    Buffer.from(parts[i] as string, "base64url"),
  );
  if (salt.length === 0 || nonce.length !== NONCE_LEN || tag.length !== 16 || ct.length === 0) {
    throw new Error("malformed encrypted payload");
  }
  return { version, salt, nonce, ct, tag };
}

function kekFor(version: number): Kek {
  const { current, older } = keys();
  if (version === current.version) return current;
  const old = older.get(version);
  if (!old) throw new Error(`no key configured for version ${version}`);
  return old;
}

export function decryptField(opts: {
  recordId: string;
  fieldName: string;
  payload: string;
}): string {
  const { recordId, fieldName, payload } = opts;
  const { version, salt, nonce, ct, tag } = parsePayload(payload);
  const kek = kekFor(version);
  const decipher = createDecipheriv("aes-256-gcm", deriveDek(kek.key, salt), nonce);
  decipher.setAAD(aad(recordId, fieldName));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export type DecryptResult =
  | { ok: true; value: string }
  | { ok: false; reason: string };

/** Non-throwing variant for rendering paths. Reason never contains plaintext or ciphertext. */
export function tryDecryptField(opts: {
  recordId: string;
  fieldName: string;
  payload: string;
}): DecryptResult {
  try {
    return { ok: true, value: decryptField(opts) };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "decryption failed",
    };
  }
}

/** Rotation helper: decrypt with whatever key the payload names, re-encrypt under the current key. */
export function reEncryptField(opts: {
  recordId: string;
  fieldName: string;
  payload: string;
}): string {
  return encryptField({
    recordId: opts.recordId,
    fieldName: opts.fieldName,
    plaintext: decryptField(opts),
  });
}

/** Safe stand-in for logging: never echoes plaintext or ciphertext contents. */
export function redactForLog(value: string): string {
  return `[encrypted:${value.length}B]`;
}