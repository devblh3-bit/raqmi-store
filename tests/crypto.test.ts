import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  encryptField,
  decryptField,
  tryDecryptField,
  reEncryptField,
  currentKeyVersion,
  redactForLog,
  _resetKeyCacheForTests,
} from "../src/lib/crypto";

const KEY_V1 = "a".repeat(64); // hex KEK
const KEY_V2 = "b".repeat(64);
const KEY_V2_B64 = Buffer.from("c".repeat(32)).toString("base64");

const PLAINTEXT = "customer@example.com / secret-token-XYZ";

function setEnv(env: Record<string, string | undefined>) {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("ENCRYPTION_KEY")) delete process.env[k];
  }
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined) process.env[k] = v;
  }
  _resetKeyCacheForTests();
}

beforeEach(() => setEnv({ ENCRYPTION_KEY: KEY_V1 }));
afterEach(() => setEnv({}));

describe("crypto round-trip", () => {
  it("encrypts and decrypts back to the same plaintext", () => {
    const p = encryptField({ recordId: "order_item_1", fieldName: "customerInput", plaintext: PLAINTEXT });
    expect(decryptField({ recordId: "order_item_1", fieldName: "customerInput", payload: p })).toBe(PLAINTEXT);
  });

  it("payload is serialized, self-describing and does not leak plaintext", () => {
    const p = encryptField({ recordId: "r1", fieldName: "deliveryPayload", plaintext: PLAINTEXT });
    expect(p).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(p).not.toContain("customer@example.com");
    expect(p).not.toContain("secret-token");
  });

  it("nonces differ across encryptions of identical plaintext", () => {
    const a = encryptField({ recordId: "r1", fieldName: "f", plaintext: "same" });
    const b = encryptField({ recordId: "r1", fieldName: "f", plaintext: "same" });
    const [na, nb] = [a, b].map((x) => x.split(".")[2]);
    const [sa, sb] = [a, b].map((x) => x.split(".")[1]);
    expect(na).not.toBe(nb); // fresh nonce per encryption
    expect(sa).not.toBe(sb); // fresh HKDF salt per record
    expect(a).not.toBe(b);
  });
});

describe("AAD binding", () => {
  const payload = () =>
    encryptField({ recordId: "order_item_1", fieldName: "customerInput", plaintext: PLAINTEXT });

  it("fails to decrypt with a different recordId", () => {
    expect(() =>
      decryptField({ recordId: "order_item_2", fieldName: "customerInput", payload: payload() })
    ).toThrow();
  });

  it("fails to decrypt with a different fieldName", () => {
    expect(() =>
      decryptField({ recordId: "order_item_1", fieldName: "deliveryPayload", payload: payload() })
    ).toThrow();
  });
});

describe("tampering", () => {
  const payload = () =>
    encryptField({ recordId: "r1", fieldName: "f", plaintext: PLAINTEXT });

  it("flipped ciphertext bit fails", () => {
    const parts = payload().split(".");
    const ct = Buffer.from(parts[3]!, "base64url");
    ct[0] ^= 0xff;
    parts[3] = ct.toString("base64url");
    expect(() => decryptField({ recordId: "r1", fieldName: "f", payload: parts.join(".") })).toThrow();
  });

  it("flipped tag bit fails", () => {
    const parts = payload().split(".");
    const tag = Buffer.from(parts[4]!, "base64url");
    tag[0] ^= 0xff;
    parts[4] = tag.toString("base64url");
    expect(() => decryptField({ recordId: "r1", fieldName: "f", payload: parts.join(".") })).toThrow();
  });
});

describe("key rotation (multi-version KEK)", () => {
  it("writes under v1, rotates, still decrypts v1, new writes are v2", () => {
    const v1Payload = encryptField({ recordId: "r1", fieldName: "f", plaintext: PLAINTEXT });
    expect(currentKeyVersion()).toBe(1);

    // Rotate: old KEK moves to ENCRYPTION_KEY_V1, new KEK becomes ENCRYPTION_KEY.
    setEnv({ ENCRYPTION_KEY: KEY_V2, ENCRYPTION_KEY_V1: KEY_V1 });
    expect(currentKeyVersion()).toBe(2);

    // Old rows still decrypt.
    expect(decryptField({ recordId: "r1", fieldName: "f", payload: v1Payload })).toBe(PLAINTEXT);
    // New writes are v2 and decrypt under the new KEK.
    const v2Payload = encryptField({ recordId: "r1", fieldName: "f", plaintext: PLAINTEXT });
    expect(v2Payload.startsWith("v2.")).toBe(true);
    expect(decryptField({ recordId: "r1", fieldName: "f", payload: v2Payload })).toBe(PLAINTEXT);

    // reEncryptField migrates a v1 row to v2 without changing the plaintext.
    const migrated = reEncryptField({ recordId: "r1", fieldName: "f", payload: v1Payload });
    expect(migrated.startsWith("v2.")).toBe(true);
    expect(decryptField({ recordId: "r1", fieldName: "f", payload: migrated })).toBe(PLAINTEXT);

    // After dropping the old KEK (version pinned so current stays v2), v1 rows fail loudly.
    setEnv({ ENCRYPTION_KEY: KEY_V2, ENCRYPTION_KEY_VERSION: "2" });
    expect(currentKeyVersion()).toBe(2);
    // Migrated v2 rows still decrypt after the drop.
    expect(decryptField({ recordId: "r1", fieldName: "f", payload: migrated })).toBe(PLAINTEXT);
    expect(() => decryptField({ recordId: "r1", fieldName: "f", payload: v1Payload })).toThrow(/version 1/);
  });

  it("accepts the KEK as base64 as well as hex", () => {
    setEnv({ ENCRYPTION_KEY: KEY_V2_B64 });
    const p = encryptField({ recordId: "r1", fieldName: "f", plaintext: "x" });
    expect(decryptField({ recordId: "r1", fieldName: "f", payload: p })).toBe("x");
  });
});

describe("key validation fails loudly", () => {
  it("missing ENCRYPTION_KEY throws with a clear message", () => {
    setEnv({});
    expect(() => encryptField({ recordId: "r1", fieldName: "f", plaintext: "x" })).toThrow(/ENCRYPTION_KEY is missing/);
  });

  it.each(["short", "z".repeat(63), Buffer.from("too-short").toString("base64")])(
    "malformed key %s throws",
    (bad) => {
      setEnv({ ENCRYPTION_KEY: bad });
      expect(() => encryptField({ recordId: "r1", fieldName: "f", plaintext: "x" })).toThrow(/32 bytes/);
    },
  );
});

describe("error hygiene", () => {
  it("errors never contain the plaintext", () => {
    const p = encryptField({ recordId: "r1", fieldName: "f", plaintext: PLAINTEXT });
    let msg = "";
    try {
      decryptField({ recordId: "other", fieldName: "f", payload: p });
    } catch (e) {
      msg = String(e);
    }
    expect(msg).not.toContain("customer@example.com");
    expect(msg).not.toContain("secret-token");

    // tryDecryptField returns a safe reason, never the plaintext.
    const res = tryDecryptField({ recordId: "other", fieldName: "f", payload: p });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).not.toContain(PLAINTEXT);
      expect(res.reason).not.toContain("secret-token");
    }
  });

  it("tryDecryptField succeeds on valid input", () => {
    const p = encryptField({ recordId: "r1", fieldName: "f", plaintext: PLAINTEXT });
    const res = tryDecryptField({ recordId: "r1", fieldName: "f", payload: p });
    expect(res).toEqual({ ok: true, value: PLAINTEXT });
  });

  it("redactForLog returns a safe stand-in", () => {
    const r = redactForLog(PLAINTEXT);
    expect(r).toBe(`[encrypted:${PLAINTEXT.length}B]`);
    expect(r).not.toContain("customer");
  });
});
