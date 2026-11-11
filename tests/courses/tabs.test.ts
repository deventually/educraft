import { describe, expect, it } from "vitest";
import { COURSE_TABS, courseTab, courseTabHref } from "~/lib/courses/tabs";

// Seam: the tab a course page shows, read from its URL, and the link to a tab.
describe("course tabs", () => {
  it("has five tabs, overview first", () => {
    expect(COURSE_TABS).toEqual(["overview", "outcomes", "plan", "check", "documents"]);
  });

  it("reads a known tab, and falls back to the overview", () => {
    expect(courseTab("check")).toBe("check");
    expect(courseTab(null)).toBe("overview");
    expect(courseTab("")).toBe("overview");
    expect(courseTab("nonsense")).toBe("overview");
  });

  it("links the overview without a parameter, and keeps an anchor", () => {
    expect(courseTabHref("c1", "overview")).toBe("/courses/c1");
    expect(courseTabHref("c1", "plan")).toBe("/courses/c1?tab=plan");
    expect(courseTabHref("c 1", "plan", "item-a3")).toBe("/courses/c%201?tab=plan#item-a3");
  });
});
