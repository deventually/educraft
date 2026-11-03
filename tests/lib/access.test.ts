import { describe, it, expect } from "vitest";
import { ROLES, isRole } from "~/lib/registry/access";

describe("roles (P17)", () => {
  it("knows exactly two roles", () => {
    expect([...ROLES]).toEqual(["teacher", "admin"]);
  });

  it("isRole accepts teacher and admin", () => {
    expect(isRole("teacher")).toBe(true);
    expect(isRole("admin")).toBe(true);
  });

  it("isRole rejects the legacy student role and non-strings", () => {
    expect(isRole("student")).toBe(false);
    expect(isRole("")).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(null)).toBe(false);
  });
});
