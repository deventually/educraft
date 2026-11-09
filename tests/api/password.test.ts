import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "~/server/password.server";

describe("password hashing (scrypt)", () => {
  it("hashes then verifies the same password (roundtrip)", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(await verifyPassword("Correct horse battery", stored)).toBe(false);
    expect(await verifyPassword("totally different", stored)).toBe(false);
  });

  it("stores a self-describing scrypt:<salt>:<hash> record", async () => {
    const stored = await hashPassword("abcdefghij");
    const parts = stored.split(":");
    expect(parts[0]).toBe("scrypt");
    expect(parts).toHaveLength(3);
    // salt (16 bytes → 32 hex chars) and a non-empty key.
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it("uses a distinct random salt for identical passwords", async () => {
    const a = await hashPassword("same-password-here");
    const b = await hashPassword("same-password-here");
    expect(a).not.toBe(b);
    // Both still verify.
    expect(await verifyPassword("same-password-here", a)).toBe(true);
    expect(await verifyPassword("same-password-here", b)).toBe(true);
  });

  it("runs off the event loop: both functions return a Promise", () => {
    const hashing = hashPassword("abcdefghij");
    expect(hashing).toBeInstanceOf(Promise);
    expect(verifyPassword("x", "scrypt:00:00")).toBeInstanceOf(Promise);
    return hashing;
  });

  it("returns false for a malformed stored value instead of throwing", async () => {
    expect(await verifyPassword("x", "not-a-valid-record")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "scrypt:only-two")).toBe(false);
  });
});

describe("NO_PASSWORD (P18.7)", () => {
  it("is a record verifyPassword always rejects, whatever is typed", async () => {
    const { NO_PASSWORD } = await import("~/server/password.server");
    for (const typed of ["", "none", "scrypt", "none:none:none", "correct horse battery"]) {
      expect(await verifyPassword(typed, NO_PASSWORD)).toBe(false);
    }
    // It is not a three-part scrypt record (the only shape verifyPassword accepts).
    expect(NO_PASSWORD.split(":")).toHaveLength(1);
  });
});
