import { describe, it, expect } from "vitest";
import { getEffectiveRole, isViewingAsTeacher, viewAsSetCookie } from "~/server/roleView.server";

function req(cookie?: string): Request {
  return new Request("http://localhost/", { headers: cookie ? { Cookie: cookie } : {} });
}

describe("view-as effective role (Phase 4)", () => {
  it("downshifts an admin to teacher only when the cookie is set", () => {
    expect(getEffectiveRole({ role: "admin" }, req("viewAs=teacher"))).toBe("teacher");
    expect(getEffectiveRole({ role: "admin" }, req())).toBe("admin");
  });

  it("never raises privilege — a teacher stays a teacher, a student a student", () => {
    // The cookie can only lower privilege; a non-admin's cookie is inert.
    expect(getEffectiveRole({ role: "teacher" }, req("viewAs=teacher"))).toBe("teacher");
    expect(getEffectiveRole({ role: "student" }, req("viewAs=teacher"))).toBe("student");
    // There is no cookie value that grants admin.
    expect(getEffectiveRole({ role: "teacher" }, req("viewAs=admin"))).toBe("teacher");
  });

  it("reads the cookie flag", () => {
    expect(isViewingAsTeacher(req("viewAs=teacher"))).toBe(true);
    expect(isViewingAsTeacher(req())).toBe(false);
    expect(isViewingAsTeacher(req("viewAs=admin"))).toBe(false);
  });

  it("builds a persistent cookie for teacher view and an expiring one to go back", () => {
    expect(viewAsSetCookie("teacher")).toContain("viewAs=teacher");
    expect(viewAsSetCookie("teacher")).toContain("Max-Age=31536000");
    expect(viewAsSetCookie("admin")).toContain("Max-Age=0");
  });
});
