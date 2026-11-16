import { describe, it, expect } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  adminPasswordProblem,
  passwordProblem,
  strictAdminPasswords,
} from "~/server/password.server";

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

describe("adminPasswordProblem (an admin sets someone else's password)", () => {
  it("applies the full rule in production", () => {
    expect(adminPasswordProblem("welkom", { production: true })).toBe("passwordTooShort");
    expect(adminPasswordProblem("Welkom2026!", { production: true })).toBe("passwordCommon");
    expect(adminPasswordProblem("paars-giraffe-fietst-traag", { production: true })).toBeNull();
  });

  it("accepts any password outside production, even an easy one", () => {
    expect(adminPasswordProblem("welkom", { production: false })).toBeNull();
    expect(adminPasswordProblem("a", { production: false })).toBeNull();
    expect(adminPasswordProblem("Welkom2026!", { production: false })).toBeNull();
  });

  it("still refuses an empty password outside production", () => {
    expect(adminPasswordProblem("", { production: false })).toBe("passwordTooShort");
  });

  it("reads production from NODE_ENV by default, like the local models", () => {
    expect(strictAdminPasswords()).toBe(process.env.NODE_ENV === "production");
  });

  it("never relaxes the rule for a password someone chooses themselves", () => {
    // Sign-up, reset and /account keep using passwordProblem, in every environment.
    expect(passwordProblem("welkom")).toBe("passwordTooShort");
  });
});
