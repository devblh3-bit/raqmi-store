import { describe, it, expect } from "vitest";
import {
  generateOrderCode,
  normalizeOrderCode,
  isValidOrderCodeFormat,
} from "../src/lib/order-code";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

describe("format", () => {
  it("RQM- prefix + 21 Crockford chars (20 data + 1 check)", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateOrderCode();
      expect(code).toMatch(/^RQM-[0-9A-HJKMNP-TV-Z]{21}$/);
      // no confusables in output
      expect(code.slice(4)).not.toMatch(/[ILOU]/);
    }
  });

  it("generated codes pass their own checksum", () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidOrderCodeFormat(generateOrderCode())).toBe(true);
    }
  });
});

describe("uniqueness", () => {
  it("no collisions over 10k codes (100 bits entropy)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) seen.add(generateOrderCode());
    expect(seen.size).toBe(10_000);
  });
});

describe("normalizeOrderCode", () => {
  it("is identity on a canonical code", () => {
    const code = generateOrderCode();
    expect(normalizeOrderCode(code)).toBe(code);
  });

  it("handles lowercase, spaces, hyphens, dots, and missing prefix", () => {
    const code = generateOrderCode();
    const body = code.slice(4);
    expect(normalizeOrderCode(code.toLowerCase())).toBe(code);
    expect(normalizeOrderCode(body)).toBe(code); // no prefix
    expect(normalizeOrderCode(`rqm ${body.slice(0, 7)}-${body.slice(7, 14)}.${body.slice(14)}`)).toBe(code);
  });

  it("maps confusables I->1, L->1, O->0", () => {
    const code = generateOrderCode();
    const mangled = code
      .slice(4)
      .replace(/1/g, "I")
      .replace(/0/g, "O")
      .toLowerCase()
      .replace(/i/g, "l"); // l -> 1 too
    expect(normalizeOrderCode(mangled)).toBe(code);
  });

  it("rejects wrong length and bad charset", () => {
    expect(normalizeOrderCode("")).toBeNull();
    expect(normalizeOrderCode("RQM-")).toBeNull();
    expect(normalizeOrderCode("RQM-" + "A".repeat(20))).toBeNull(); // 20, needs 21
    expect(normalizeOrderCode("RQM-" + "A".repeat(22))).toBeNull();
    expect(normalizeOrderCode("RQM-" + "A".repeat(20) + "U")).toBeNull(); // U not in Crockford
    expect(normalizeOrderCode("RQM-" + "A".repeat(20) + "!")).toBeNull();
    expect(normalizeOrderCode("RQM-" + "أ".repeat(21))).toBeNull();
  });
});

describe("isValidOrderCodeFormat", () => {
  it("rejects wrong length, charset, and corrupted checksum", () => {
    expect(isValidOrderCodeFormat("")).toBe(false);
    expect(isValidOrderCodeFormat("RQM-SHORT")).toBe(false);
    expect(isValidOrderCodeFormat("RQM-" + "U".repeat(21))).toBe(false);

    // single-character substitution flips the checksum
    const code = generateOrderCode();
    const body = code.slice(4);
    const i = 5;
    const swapped =
      body.slice(0, i) +
      ALPHABET[(ALPHABET.indexOf(body[i]) + 1) % 32] +
      body.slice(i + 1);
    expect(isValidOrderCodeFormat("RQM-" + swapped)).toBe(false);
  });

  it("accepts valid codes in messy user input form", () => {
    const code = generateOrderCode();
    expect(isValidOrderCodeFormat(code.toLowerCase().replace("rqm-", "rqm "))).toBe(true);
  });
});
