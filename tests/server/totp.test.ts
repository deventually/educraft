// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  normalizeRecoveryCode,
  otpauthUri,
  totpCode,
  verifyTotp,
} from "~/server/totp.server";

// RFC 6238, appendix B: the SHA-1 seed "12345678901234567890", 30-second steps.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));

describe("TOTP (RFC 6238)", () => {
  it.each([
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
  ])("at %i seconds the code is %s (last 6 digits of the RFC vectors)", (seconds, code) => {
    expect(totpCode(RFC_SECRET, Math.floor(seconds / 30))).toBe(code);
  });

  it("base32 round-trips and ignores case, spaces and padding", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 7]);
    const encoded = base32Encode(bytes);
    expect(encoded).toMatch(/^[A-Z2-7]+$/);
    expect(base32Decode(encoded)).toEqual(bytes);
    expect(base32Decode(` ${encoded.toLowerCase().replace(/(.{4})/g, "$1 ")}==`)).toEqual(bytes);
  });

  it("a new secret is 160 bits, base32, and different each time", () => {
    const a = generateTotpSecret();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(a)).toHaveLength(20);
    expect(generateTotpSecret()).not.toBe(a);
  });

  it("accepts the current code and one step either side, and returns the step", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30_000);
    for (const s of [step - 1, step, step + 1]) {
      expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, s), { now })).toBe(s);
    }
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 2), { now })).toBeNull();
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 2), { now })).toBeNull();
  });

  it("refuses a code that was already used (no replay) and anything not six digits", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30_000);
    const code = totpCode(RFC_SECRET, step);
    expect(verifyTotp(RFC_SECRET, code, { now, lastStep: step })).toBeNull();
    expect(verifyTotp(RFC_SECRET, code, { now, lastStep: step - 1 })).toBe(step);
    expect(verifyTotp(RFC_SECRET, "12345", { now })).toBeNull();
    expect(verifyTotp(RFC_SECRET, "abcdef", { now })).toBeNull();
  });

  it("allows spaces in a typed code", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30_000);
    const code = totpCode(RFC_SECRET, step);
    expect(verifyTotp(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, { now })).toBe(step);
  });

  it("builds an otpauth link an authenticator app understands", () => {
    const uri = otpauthUri("ABCDEFGH", "jan@school.nl", "LimeOnIt");
    expect(uri).toBe(
      "otpauth://totp/LimeOnIt:jan%40school.nl?secret=ABCDEFGH&issuer=LimeOnIt&algorithm=SHA1&digits=6&period=30",
    );
  });
});

describe("recovery codes", () => {
  it("makes 10 distinct codes in the form xxxxx-xxxxx", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[a-z2-7]{5}-[a-z2-7]{5}$/);
  });

  it("hashes a code regardless of case, spaces and the dash", () => {
    const [code] = generateRecoveryCodes(1);
    const typed = ` ${code!.toUpperCase().replace("-", " ")} `;
    expect(normalizeRecoveryCode(typed)).toBe(code!.replace("-", ""));
    expect(hashRecoveryCode(typed)).toBe(hashRecoveryCode(code!));
    expect(hashRecoveryCode(code!)).not.toContain(code!.replace("-", ""));
  });
});
