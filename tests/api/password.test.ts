import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "~/server/password.server";

describe("password hashing (scrypt)", () => {
  it("hashes then verifies the same password (roundtrip)", () => {
    const stored = hashPassword("correct horse battery");
    expect(verifyPassword("correct horse battery", stored)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const stored = hashPassword("correct horse battery");
    expect(verifyPassword("Correct horse battery", stored)).toBe(false);
    expect(verifyPassword("totally different", stored)).toBe(false);
  });

  it("stores a self-describing scrypt:<salt>:<hash> record", () => {
    const stored = hashPassword("abcdefghij");
    const parts = stored.split(":");
    expect(parts[0]).toBe("scrypt");
    expect(parts).toHaveLength(3);
    // salt (16 bytes → 32 hex chars) and a non-empty key.
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it("uses a distinct random salt for identical passwords", () => {
    const a = hashPassword("same-password-here");
    const b = hashPassword("same-password-here");
    expect(a).not.toBe(b);
    // Both still verify.
    expect(verifyPassword("same-password-here", a)).toBe(true);
    expect(verifyPassword("same-password-here", b)).toBe(true);
  });

  it("returns false for a malformed stored value instead of throwing", () => {
    expect(verifyPassword("x", "not-a-valid-record")).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "scrypt:only-two")).toBe(false);
  });
});
