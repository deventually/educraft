import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { CourseWeekView } from "~/components/courses/CourseWeekView";
import type { CourseTools } from "~/lib/registry/courseActions";
import { alignedCourse, ACT1, ACT2, QUIZ, TEST1 } from "../courses/fixtures";

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

function renderWeek(
  data = alignedCourse(),
  locale = "nl",
  weekDates: string[] | null = null,
  currentWeek: number | null = null,
) {
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
              currentWeek={currentWeek}
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
    d.assessments[1]!.week = undefined;
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

  it("marks the current course week", async () => {
    renderWeek(alignedCourse(), "nl", null, 2);
    const region = await screen.findByRole("region", { name: "Per week" });
    const current = within(region).getByText("Deze week").closest("li") as HTMLElement;
    expect(current).toHaveAttribute("aria-current", "date");
    expect(within(current).getByRole("heading", { level: 3, name: /Week 2/ })).toBeInTheDocument();
  });

  it("marks no week without a current week", async () => {
    renderWeek();
    await screen.findByRole("region", { name: "Per week" });
    expect(screen.queryByText("Deze week")).toBeNull();
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

describe("CourseWeekView — per discipline (step D)", () => {
  function withDisciplines() {
    const d = alignedCourse();
    d.disciplines = [
      { id: "web", name: "Webtech" },
      { id: "hw", name: "Hardware" },
    ];
    d.activities[0]!.disciplineId = "web";
    d.activities[1]!.disciplineId = "hw";
    return d;
  }

  it("offers no discipline filter when the course has no disciplines", async () => {
    renderWeek();
    await screen.findByRole("region", { name: "Per week" });
    expect(screen.queryByRole("combobox", { name: "Discipline" })).toBeNull();
  });

  it("shows all disciplines first, and the discipline at each lesson", async () => {
    renderWeek(withDisciplines());
    const filter = await screen.findByRole("combobox", { name: "Discipline" });
    expect(filter).toHaveValue("");
    expect(
      within(filter)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Alle disciplines", "Webtech", "Hardware"]);
    const lesson = document.getElementById(`week-item-${ACT1}`) as HTMLElement;
    expect(within(lesson).getByText(/Webtech/)).toBeInTheDocument();
  });

  it("shows only that discipline's lessons, with the tests, after choosing one", async () => {
    renderWeek(withDisciplines());
    const filter = await screen.findByRole("combobox", { name: "Discipline" });
    await userEvent.selectOptions(filter, "Hardware");
    const region = screen.getByRole("region", { name: "Per week" });
    expect(document.getElementById(`week-item-${ACT1}`)).toBeNull();
    expect(document.getElementById(`week-item-${ACT2}`)).not.toBeNull();
    expect(document.getElementById(`week-item-${QUIZ}`)).not.toBeNull();
    expect(
      within(region)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(["Week 2", "Week 4"]);
    await userEvent.selectOptions(filter, "Alle disciplines");
    expect(document.getElementById(`week-item-${ACT1}`)).not.toBeNull();
  });

  it("speaks English", async () => {
    renderWeek(withDisciplines(), "en");
    const filter = await screen.findByRole("combobox", { name: "Discipline" });
    expect(within(filter).getByRole("option", { name: "All disciplines" })).toBeInTheDocument();
  });

  it("has no a11y violations with the filter", async () => {
    const { container } = renderWeek(withDisciplines());
    await screen.findByRole("combobox", { name: "Discipline" });
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
