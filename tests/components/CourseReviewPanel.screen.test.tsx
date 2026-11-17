import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { CourseReviewPanel, type ReviewPanelAgent } from "~/components/courses/CourseReviewPanel";
import { alignedCourse } from "../courses/fixtures";

// The quick check (TypeSafe's Jev) before the review team: the teacher sees which reviewer the
// check let skip, and can ask for a full review that runs every chosen reviewer.

const axeOpts = { rules: { "color-contrast": { enabled: false } } };
const designer = { agentId: "designer", role: { nl: "Ontwerper", en: "Designer" } };

function renderPanel(agents: ReviewPanelAgent[], quickCheck: boolean) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <CourseReviewPanel
          data={alignedCourse()}
          agents={agents}
          choices={[{ ...designer, focus: { nl: "Kijkt naar je lessen.", en: "x" }, chosen: true }]}
          models={[{ id: "claude-sonnet-5-5", displayName: "Sonnet 5.5" }]}
          defaultModel="claude-sonnet-5-5"
          quickCheck={quickCheck}
        />
      ),
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("CourseReviewPanel with the quick check", () => {
  it("offers a full review, off by default, only when the quick check is on", async () => {
    const { container } = renderPanel([{ ...designer, review: null }], true);
    const full = screen.getByRole("checkbox", { name: /volledige review/i });
    expect(full).not.toBeChecked();
    expect(full).toHaveAttribute("name", "full");
    expect(full).toHaveAttribute("value", "1");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no full-review box without the quick check", () => {
    renderPanel([{ ...designer, review: null }], false);
    expect(screen.queryByRole("checkbox", { name: /volledige review/i })).toBeNull();
  });

  it("says when the quick check let a reviewer skip, instead of 'no advice'", async () => {
    const { container } = renderPanel(
      [
        {
          ...designer,
          review: { id: "r1", model: "TypeSafe Jev", stale: false, screened: true, findings: [] },
        },
      ],
      true,
    );
    expect(screen.getByText(/snelle check.*niets gevonden/i)).toBeVisible();
    expect(screen.queryByText("Geen adviezen van deze reviewer.")).toBeNull();
    expect(screen.queryByText(/gereviewd met/i)).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
