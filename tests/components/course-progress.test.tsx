import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { CourseProgress } from "~/components/courses/CourseProgress";
import { checkAlignment } from "~/lib/courses/alignment";
import { courseProgress } from "~/lib/courses/progress";
import { emptyCourseData } from "~/lib/courses/schema";
import type { CourseData } from "~/lib/courses/types";
import { alignedCourse } from "../courses/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderFor(d: CourseData) {
  const node: ReactNode = (
    <CourseProgress courseId="c1" progress={courseProgress(d, checkAlignment(d))} />
  );
  const Stub = createRoutesStub([{ path: "/", Component: () => <>{node}</> }]);
  return render(<Stub initialEntries={["/"]} />);
}

// Seam: what the teacher reads and can follow, by role and name.
describe("Course progress: guided through the steps, free to go deeper", () => {
  it("shows how far the course is, as a progress bar and in words", async () => {
    const d = { ...alignedCourse(), activities: [] };
    const { container } = renderFor(d);
    const region = screen.getByRole("region", { name: "Voortgang" });
    const bar = within(region).getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "3");
    expect(bar).toHaveAttribute("aria-valuemax", "6");
    expect(within(region).getByText("3 van 6 stappen klaar")).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("names the next step, how to do it, and links to where it is done", () => {
    renderFor({ ...alignedCourse(), ec: 5, activities: [] });
    const next = screen.getByRole("region", { name: "Volgende stap: Lessen en opdrachten" });
    expect(within(next).getByText(/werken naar de toets toe/)).toBeVisible();
    expect(within(next).getByRole("link", { name: "Naar Lessen en toetsen" })).toHaveAttribute(
      "href",
      "/courses/c1?tab=plan",
    );
  });

  it("lists every step with what is done, each a way into its tab", () => {
    const d = { ...alignedCourse(), ec: 5 };
    d.assessments = d.assessments.filter((a) => a.kind === "formative");
    renderFor(d);
    const steps = within(screen.getByRole("list", { name: "Stappen" })).getAllByRole("listitem");
    expect(steps).toHaveLength(6);
    expect(steps[0]).toHaveTextContent("Cursusgegevens");
    expect(steps[0]).toHaveTextContent("Klaar");
    expect(steps[2]).toHaveTextContent("0 van 2 leeruitkomsten getoetst");
    expect(steps[2]).toHaveAttribute("aria-current", "step");
    expect(steps[0]).not.toHaveAttribute("aria-current");
    expect(within(steps[2]!).getByRole("link", { name: "Toetsen" })).toHaveAttribute(
      "href",
      "/courses/c1?tab=plan",
    );
  });

  it("starts an empty course at its details, on the overview", () => {
    renderFor(emptyCourseData());
    const next = screen.getByRole("region", { name: "Volgende stap: Cursusgegevens" });
    expect(within(next).getByRole("link", { name: "Naar Cursusgegevens" })).toHaveAttribute(
      "href",
      "/courses/c1#course-settings",
    );
  });

  it("says what is left to do once every step is complete", () => {
    renderFor({ ...alignedCourse(), ec: 5 });
    expect(screen.queryByRole("region", { name: /Volgende stap/ })).toBeNull();
    expect(screen.getByText(/Alle stappen zijn klaar/)).toBeVisible();
  });
});
