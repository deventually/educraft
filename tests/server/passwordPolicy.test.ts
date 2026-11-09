import { describe, it, expect } from "vitest";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "~/server/password.server";

describe("passwordProblem", () => {
  it("accepts a long, uncommon password", () => {
    expect(passwordProblem("paars-giraffe-fietst-traag")).toBeNull();
    expect(passwordProblem("Kx9#mVq2!pLw")).toBeNull();
  });

  it("refuses a password shorter than the minimum", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(10);
    expect(passwordProblem("short")).toBe("passwordTooShort");
    expect(passwordProblem("a".repeat(MIN_PASSWORD_LENGTH - 1))).toBe("passwordTooShort");
  });

  it("refuses a password on the list of commonly used passwords, whatever its case", () => {
    expect(passwordProblem("1234567890")).toBe("passwordCommon");
    expect(passwordProblem("qwertyuiop")).toBe("passwordCommon");
    expect(passwordProblem("Password123")).toBe("passwordCommon");
    expect(passwordProblem("IloveYou123")).toBe("passwordCommon");
  });

  it("refuses Dutch favourites, also with digits or symbols around them", () => {
    expect(passwordProblem("Wachtwoord123")).toBe("passwordCommon");
    expect(passwordProblem("Welkom2026!")).toBe("passwordCommon");
    expect(passwordProblem("!!Zomer2026!!")).toBe("passwordCommon");
    expect(passwordProblem("LimeOnIt2026")).toBe("passwordCommon");
  });

  it("refuses a common word padded to length with digits or symbols", () => {
    expect(passwordProblem("dragon12345")).toBe("passwordCommon");
    expect(passwordProblem("monkey!!!!!")).toBe("passwordCommon");
  });

  it("refuses one short unit repeated", () => {
    expect(passwordProblem("aaaaaaaaaaaa")).toBe("passwordCommon");
    expect(passwordProblem("abcabcabcabc")).toBe("passwordCommon");
    expect(passwordProblem("xy7!xy7!xy7!")).toBe("passwordCommon");
  });

  it("checks the length before the list", () => {
    expect(passwordProblem("welkom")).toBe("passwordTooShort");
  });
});
