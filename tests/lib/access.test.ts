import { describe, it, expect } from "vitest";
import { canUseTool } from "~/lib/registry/access";

const studentTool = { userType: "student" as const };
const instructorTool = { userType: "instructor" as const };

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
