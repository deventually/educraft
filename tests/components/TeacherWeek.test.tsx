import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { TeacherWeekView } from "~/components/week/TeacherWeek";
import type { TeacherWeek } from "~/lib/week/teacherWeek";
import type { CourseTools } from "~/lib/registry/courseActions";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const row = (itemId: string, title: string, kind: "activity" | "assessment", week = 3) => ({
  itemId,
  title,
  kind,
  week,
});
const list = (...rows: ReturnType<typeof row>[]) => ({ rows, more: 0 });

const now: TeacherWeek = {
  monday: "2026-11-16",
  isoWeek: 47,
  courses: [
    {
      courseId: "c1",
      courseName: "Databases",
      status: "week",
      week: 3,
      thisWeek: list(
        row("a3", "Les normaliseren", "activity"),
        row("t1", "Oefentoets", "assessment"),
      ),
      prepare: { rows: [row("a3", "Les normaliseren", "activity")], more: 2 },
      grade: list(row("t0", "Instaptoets", "assessment", 1)),
      findings: 2,
      agentFindings: 1,
    },
    { courseId: "c2", courseName: "Netwerken", status: "break" },
    {
      courseId: "c3",
      courseName: "Webtechniek",
      status: "week",
      week: 5,
      thisWeek: list(),
      prepare: list(),
      grade: list(),
      findings: 0,
    },
  ],
  undated: [{ courseId: "c4", courseName: "Zonder datum" }],
};

const next: TeacherWeek = {
  monday: "2026-11-23",
  isoWeek: 48,
  courses: [
    {
      courseId: "c1",
      courseName: "Databases",
      status: "week",
      week: 4,
      thisWeek: list(row("a4", "Les SQL", "activity", 4)),
      prepare: list(),
      grade: list(),
      findings: 2,
    },
  ],
  undated: [],
};

const tools: CourseTools = {
  outcome: [],
  activity: [{ slug: "lesson-plan", name: { nl: "Les voorbereiden", en: "Prepare a lesson" } }],
  assessment: [
    {
      slug: "test-analysis",
      name: { nl: "Toetsanalyse uitleggen", en: "Explain a test analysis" },
    },
  ],
  findings: {},
};

function renderWeek(
  props: { now: TeacherWeek; next: TeacherWeek | null; tools?: CourseTools },
  locale = "nl",
) {
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      loader: () => ({ locale, user: null }),
      children: [{ path: "start", Component: () => <TeacherWeekView {...props} /> }],
    },
  ]);
  return render(<Stub initialEntries={["/start"]} />);
}

describe("TeacherWeekView (P22.3)", () => {
  it("heads the week with its ISO week and dates", async () => {
    renderWeek({ now, next: null });
    const region = await screen.findByRole("region", { name: "Deze week · week 47" });
    expect(within(region).getByText(/16.22 nov/)).toBeInTheDocument();
  });

  it("shows per course the three lists, linked to the item in the course", async () => {
    renderWeek({ now, next: null });
    const region = await screen.findByRole("region", { name: "Deze week · week 47" });
    const db = within(region).getByRole("heading", { level: 3, name: /Databases/ });
    expect(within(db).getByRole("link")).toHaveAttribute("href", "/courses/c1");
    for (const name of ["In de les", "Voorbereiden", "Nakijken"])
      expect(within(region).getAllByRole("heading", { level: 4, name })[0]).toBeInTheDocument();
    const lesson = within(region).getAllByRole("link", { name: /Les normaliseren/ })[0];
    expect(lesson).toHaveAttribute("href", "/courses/c1#item-a3");
    expect(within(region).getByRole("link", { name: /Instaptoets/ })).toHaveAttribute(
      "href",
      "/courses/c1#item-t0",
    );
    expect(within(region).getByText("en nog 2")).toBeInTheDocument();
  });

  it("counts the open findings with a link to the course", async () => {
    renderWeek({ now, next: null });
    const region = await screen.findByRole("region", { name: "Deze week · week 47" });
    expect(within(region).getByRole("link", { name: "2 aandachtspunten" })).toHaveAttribute(
      "href",
      "/courses/c1",
    );
    expect(within(region).getByText("1 advies van de petten")).toBeInTheDocument();
  });

  it("gives a break one line and an empty course one line", async () => {
    renderWeek({ now, next: null });
    const region = await screen.findByRole("region", { name: "Deze week · week 47" });
    expect(within(region).getByText("Vakantie")).toBeInTheDocument();
    expect(within(region).getByText("Niets gepland deze week.")).toBeInTheDocument();
  });

  it("points to the courses without a start date", async () => {
    renderWeek({ now, next: null });
    expect(await screen.findByRole("link", { name: "Zonder datum" })).toHaveAttribute(
      "href",
      "/courses/c4",
    );
  });

  it("shows next week only when it is given (from Friday)", async () => {
    renderWeek({ now, next: null });
    await screen.findByRole("region", { name: "Deze week · week 47" });
    expect(screen.queryByRole("region", { name: /Volgende week/ })).toBeNull();
    renderWeek({ now, next });
    const later = await screen.findByRole("region", { name: "Volgende week · week 48" });
    expect(within(later).getByRole("link", { name: /Les SQL/ })).toBeInTheDocument();
  });

  it("gives every row the tools for its kind, carrying course and item (P27.4)", async () => {
    renderWeek({ now, next: null, tools });
    const region = await screen.findByRole("region", { name: "Deze week · week 47" });
    const lessonTools = within(region).getAllByRole("link", {
      name: "Les voorbereiden: Les normaliseren",
    });
    expect(lessonTools[0]).toHaveAttribute("href", "/tools/lesson-plan?course=c1&item=a3");
    expect(
      within(region).getByRole("link", { name: "Toetsanalyse uitleggen: Instaptoets" }),
    ).toHaveAttribute("href", "/tools/test-analysis?course=c1&item=t0");
  });

  it("shows no tool links without tools", async () => {
    renderWeek({ now, next: null });
    const region = await screen.findByRole("region", { name: "Deze week · week 47" });
    expect(within(region).queryByRole("link", { name: /Les voorbereiden/ })).toBeNull();
  });

  it("speaks English", async () => {
    renderWeek({ now, next }, "en");
    expect(await screen.findByRole("region", { name: "This week · week 47" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Next week · week 48" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 4, name: "To prepare" })[0]).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = renderWeek({ now, next, tools });
    await screen.findByRole("region", { name: "Deze week · week 47" });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
