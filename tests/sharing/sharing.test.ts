import { describe, expect, it } from "vitest";
import { ALL_TOOLS, WORKPLACE_TOOLS, getToolBySlugOrThrow } from "~/lib/registry";
import { validateTools } from "~/lib/registry/validate";
import type { Tool } from "~/lib/registry/types";
import { SHARE_KINDS, SHAREABLE_WORK_SLUGS, isShareableWork } from "~/lib/sharing";

/** P28.4: what may ever reach a colleague is decided by data, here. */
describe("Tool.handlesStudentWork (P28.4)", () => {
  it("marks exactly the tools that process student work", () => {
    const marked = [...ALL_TOOLS, ...WORKPLACE_TOOLS]
      .filter((t) => t.handlesStudentWork)
      .map((t) => t.slug)
      .sort();
    expect(marked).toEqual([
      "defense-review",
      "forum-autograder",
      "math-grading",
      "stage-assessment",
      "test-analysis",
      "visit-report",
    ]);
  });

  it("is validated as `true` when present", () => {
    const tool = {
      ...getToolBySlugOrThrow("lesson-plan"),
      handlesStudentWork: "yes",
    } as unknown as Tool;
    expect(
      validateTools([tool])
        .map((i) => i.message)
        .join("\n"),
    ).toMatch(/handlesStudentWork/);
  });
});

describe("isShareableWork (P28.4)", () => {
  it("never lets student work, a chat or dossier work reach a colleague", () => {
    for (const slug of [
      "stage-assessment",
      "math-grading",
      "test-analysis",
      "forum-autograder",
      "defense-review",
    ])
      expect(isShareableWork(getToolBySlugOrThrow(slug))).toBe(false);
    // Chats are never shareable (BESLUIT-2026-11-05-5, 2).
    expect(isShareableWork(getToolBySlugOrThrow("mentorai"))).toBe(false);
    expect(isShareableWork(getToolBySlugOrThrow("difficult-conversation"))).toBe(false);
    // The rehearsal works on the dossier, which is never shareable.
    expect(isShareableWork(getToolBySlugOrThrow("portfolio-rehearsal"))).toBe(false);
  });

  it("lets lesson material through", () => {
    for (const slug of ["lesson-plan", "test-items", "rubric-builder", "clear-assignment"])
      expect(isShareableWork(getToolBySlugOrThrow(slug))).toBe(true);
    expect(SHAREABLE_WORK_SLUGS).toContain("lesson-plan");
    expect(SHAREABLE_WORK_SLUGS).not.toContain("stage-assessment");
  });

  it("shares only courses, rubrics and context profiles: never a dossier or scores", () => {
    expect([...SHARE_KINDS]).toEqual(["course", "rubric", "contextProfile"]);
  });
});
