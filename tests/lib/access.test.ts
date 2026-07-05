import { describe, it, expect } from "vitest";
import { canUseTool } from "~/lib/registry/access";

const studentTool = { slug: "mentorai", userType: "student" as const };
const instructorTool = { slug: "bloom-by-design", userType: "instructor" as const };

describe("canUseTool — role × tool visibility", () => {
  it("students may use student tools", () => {
    expect(canUseTool({ role: "student" }, studentTool)).toBe(true);
  });

  it("students may NOT use instructor tools", () => {
    expect(canUseTool({ role: "student" }, instructorTool)).toBe(false);
  });

  it("teachers may use both (they preview student tools)", () => {
    expect(canUseTool({ role: "teacher" }, studentTool)).toBe(true);
    expect(canUseTool({ role: "teacher" }, instructorTool)).toBe(true);
  });

  it("admins may use both", () => {
    expect(canUseTool({ role: "admin" }, studentTool)).toBe(true);
    expect(canUseTool({ role: "admin" }, instructorTool)).toBe(true);
  });
});

describe("canUseTool — cohort allow-list (Phase 6)", () => {
  const socratic = { slug: "socratic-partner", userType: "student" as const };

  it("a student may use a student tool that is in their cohort's allow-list", () => {
    const allowed = new Set(["mentorai", "socratic-partner"]);
    expect(canUseTool({ role: "student" }, studentTool, allowed)).toBe(true);
    expect(canUseTool({ role: "student" }, socratic, allowed)).toBe(true);
  });

  it("a student may NOT use a student tool that is outside their cohort's allow-list", () => {
    const allowed = new Set(["mentorai"]);
    expect(canUseTool({ role: "student" }, socratic, allowed)).toBe(false);
  });

  it("null/undefined allowedSlugs leaves today's behaviour (all student tools)", () => {
    expect(canUseTool({ role: "student" }, studentTool, null)).toBe(true);
    expect(canUseTool({ role: "student" }, socratic, undefined)).toBe(true);
    // …but an instructor tool is still off-limits regardless of the allow-list.
    expect(canUseTool({ role: "student" }, instructorTool, null)).toBe(false);
  });

  it("the allow-list never constrains teachers/admins", () => {
    const allowed = new Set(["mentorai"]);
    expect(canUseTool({ role: "teacher" }, socratic, allowed)).toBe(true);
    expect(canUseTool({ role: "admin" }, instructorTool, allowed)).toBe(true);
  });
});

describe('canUseTool — audience "both" (Phase 4 override)', () => {
  const bothTool = { slug: "bloom-by-design", userType: "both" as const };

  it("a student MAY use a tool whose (effective) audience is both", () => {
    expect(canUseTool({ role: "student" }, bothTool)).toBe(true);
  });

  it('"both" is still narrowed by the student cohort allow-list', () => {
    expect(canUseTool({ role: "student" }, bothTool, new Set(["bloom-by-design"]))).toBe(true);
    expect(canUseTool({ role: "student" }, bothTool, new Set(["mentorai"]))).toBe(false);
  });

  it("teachers and admins may use a both tool unconditionally", () => {
    expect(canUseTool({ role: "teacher" }, bothTool)).toBe(true);
    expect(canUseTool({ role: "admin" }, bothTool)).toBe(true);
  });
});
