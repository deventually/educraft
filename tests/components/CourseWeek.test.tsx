import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { CourseWeekView } from "~/components/courses/CourseWeekView";
import type { CourseTools } from "~/lib/registry/courseActions";
import { alignedCourse, ACT1, QUIZ, TEST1 } from "../courses/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const tools: CourseTools = {
  outcome: [],
  activity: [{ slug: "lesson-plan", name: { nl: "Les voorbereiden", en: "Prepare a lesson" } }],
  assessment: [
    { slug: "test-items", name: { nl: "Toetsvragen maken", en: "Write test questions" } },
    { slug: "rubric-builder", name: { nl: "Beoordelingsmodel maken", en: "Create a rubric" } },
  ],
  findings: {},
};

const work = [
  {
    generationId: "g1",
    itemId: QUIZ,
    toolName: { nl: "Toetsvragen maken", en: "Write test questions" },
    itemTitle: "Oefentoets",
    createdAt: "2026-11-02T10:00:00Z",
  },
  {
    generationId: "g2",
    itemId: null,
    toolName: { nl: "Les voorbereiden", en: "Prepare a lesson" },
    itemTitle: null,
    createdAt: "2026-11-03T10:00:00Z",
  },
];

function renderWeek(data = alignedCourse(), locale = "nl", weekDates: string[] | null = null) {
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      loader: () => ({ locale, user: null }),
      children: [
        {
          path: "courses/c1",
          Component: () => (
            <CourseWeekView
              courseId="c1"
              data={data}
              tools={tools}
              work={work}
              weekDates={weekDates}
            />
          ),
        },
      ],
    },
  ]);
  return render(<Stub initialEntries={["/courses/c1"]} />);
}

describe("CourseWeekView (P27.4)", () => {
  it("shows the course per week, each item with the tools for its kind", async () => {
    renderWeek();
    const region = await screen.findByRole("region", { name: "Per week" });
    const week2 = within(region).getByRole("heading", { level: 3, name: /Week 2/ });
    expect(week2).toBeInTheDocument();
    expect(
      within(region).getByRole("link", { name: "Les voorbereiden: Les normaliseren" }),
    ).toHaveAttribute("href", `/tools/lesson-plan?course=c1&item=${ACT1}`);
    expect(
      within(region).getByRole("link", { name: "Toetsvragen maken: Eindopdracht" }),
    ).toHaveAttribute("href", `/tools/test-items?course=c1&item=${TEST1}`);
    expect(
      within(region).getByRole("link", { name: "Beoordelingsmodel maken: Oefentoets" }),
    ).toHaveAttribute("href", `/tools/rubric-builder?course=c1&item=${QUIZ}`);
  });

  it("shows linked work at the item it belongs to", async () => {
    renderWeek();
    await screen.findByRole("region", { name: "Per week" });
    const quiz = document.getElementById(`week-item-${QUIZ}`) as HTMLElement;
    expect(within(quiz).getByText(/Toetsvragen maken · /)).toBeInTheDocument();
    const lesson = document.getElementById(`week-item-${ACT1}`) as HTMLElement;
    expect(within(lesson).queryByText(/Les voorbereiden · /)).toBeNull();
  });

  it("puts items without a week at the bottom", async () => {
    const d = alignedCourse();
    d.assessments[1].week = undefined;
    renderWeek(d);
    const region = await screen.findByRole("region", { name: "Per week" });
    const headings = within(region)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(headings.at(-1)).toBe("Zonder week");
  });

  it("says so when no item has a week", async () => {
    renderWeek({ outcomes: [], activities: [], assessments: [] });
    const region = await screen.findByRole("region", { name: "Per week" });
    expect(within(region).getByText("Nog geen lessen of toetsen.")).toBeInTheDocument();
  });

  it("shows the dates of a week when the course has a start date", async () => {
    renderWeek(alignedCourse(), "nl", ["2026-11-16", "2026-11-23", "2026-11-30", "2026-12-07"]);
    const region = await screen.findByRole("region", { name: "Per week" });
    expect(
      within(region).getByRole("heading", { level: 3, name: /Week 1 · 16.22 nov/ }),
    ).toBeInTheDocument();
  });

  it("speaks English", async () => {
    renderWeek(alignedCourse(), "en");
    expect(await screen.findByRole("region", { name: "By week" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Prepare a lesson: Les normaliseren" }),
    ).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = renderWeek();
    await screen.findByRole("region", { name: "Per week" });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("OutcomesSection — tool buttons per outcome (P27.4)", () => {
  it("opens an outcome tool for the course, without an item", async () => {
    const { OutcomesSection } = await import("~/components/courses/OutcomesSection");
    const Stub = createRoutesStub([
      {
        id: "root",
        path: "/",
        loader: () => ({ locale: "nl", user: null }),
        Component: () => (
          <OutcomesSection
            data={alignedCourse()}
            courseId="c1"
            tools={[{ slug: "bloom-by-design", name: { nl: "Technologie kiezen", en: "Choose" } }]}
          />
        ),
      },
    ]);
    const { container } = render(<Stub initialEntries={["/"]} />);
    const links = await screen.findAllByRole("link", { name: /^Technologie kiezen: LU/ });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/tools/bloom-by-design?course=c1");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
