import { describe, expect, it } from "vitest";
import type { ComponentType } from "react";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import CourseList from "~/routes/courses._index";
import CoursePage from "~/routes/courses.$id";
import { checkAlignment, coverageMatrix } from "~/lib/courses/alignment";
import { emptyCourseData } from "~/lib/courses/schema";
import type { CourseData } from "~/lib/courses/types";
import { alignedCourse, itemizedCourse } from "../courses/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

// createRoutesStub doesn't inject loaderData in library mode; pass it through a wrapper.
// biome-ignore lint/suspicious/noExplicitAny: route components take framework-typed props
function renderRoute(Component: ComponentType<any>, loaderData: unknown) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <Component loaderData={loaderData} /> },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

function pageData(data: CourseData = alignedCourse()) {
  return {
    course: { id: "c1", name: "Software Engineering — jaar 2", contextProfileId: null, data },
    profiles: [{ id: "p1", name: "SE jaar 2" }],
    findings: checkAlignment(data),
    matrix: coverageMatrix(data),
    linkedWork: [] as {
      generationId: string;
      toolName: { nl: string; en: string } | string;
      itemTitle: string | null;
      createdAt: Date;
    }[],
  };
}

describe("Course list (/courses)", () => {
  it("shows a create form and a guided empty state", async () => {
    const { container } = renderRoute(CourseList, { courses: [], profiles: [] });
    expect(screen.getByRole("heading", { level: 1, name: "Cursussen" })).toBeVisible();
    expect(screen.getByLabelText("Naam")).toBeRequired();
    expect(screen.getByLabelText("Onderwijscontext")).toHaveDisplayValue("Geen");
    expect(screen.getByRole("heading", { level: 2, name: "Nog geen cursus" })).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("lists courses with their outcomes and findings as text", async () => {
    const { container } = renderRoute(CourseList, {
      courses: [{ id: "c1", name: "SE jaar 2", outcomes: 3, findings: 2 }],
      profiles: [{ id: "p1", name: "SE" }],
    });
    expect(screen.getByRole("link", { name: "SE jaar 2" })).toHaveAttribute("href", "/courses/c1");
    expect(screen.getByText("3 leeruitkomsten · 2 aandachtspunten")).toBeVisible();
    expect(screen.getByRole("button", { name: "Verwijderen: SE jaar 2" })).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("Course editor (/courses/:id)", () => {
  it("renders every section", async () => {
    const { container } = renderRoute(CoursePage, pageData());
    for (const name of [
      "Cursusgegevens",
      "Aandachtspunten",
      "Leeruitkomsten",
      "Onderwijsactiviteiten",
      "Toetsen",
      "Dekkingsmatrix",
    ])
      expect(screen.getByRole("heading", { level: 2, name })).toBeVisible();
    expect(screen.getByText("Geen aandachtspunten. Alles sluit op elkaar aan.")).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows the matrix as a real table with a caption, scoped headers and text cells", () => {
    renderRoute(CoursePage, pageData());
    const table = screen.getByRole("table", {
      name: "Welke activiteit en welke toets dekt welke leeruitkomst",
    });
    expect(within(table).getByRole("columnheader", { name: /Eindopdracht/ })).toHaveAttribute(
      "scope",
      "col",
    );
    const lu1 = within(table).getByRole("rowheader", { name: "LU1" });
    expect(lu1).toHaveAttribute("scope", "row");
    const row = lu1.closest("tr") as HTMLElement;
    // Les normaliseren · Opdracht datamodel · Oefentoets · Eindopdracht
    const cells = within(row).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("niet gedekt");
    expect(cells[1]).toHaveTextContent("gedekt");
    expect(cells[3]).toHaveTextContent("creëren");
  });

  it("renders a finding as text with the outcome and the item", async () => {
    const d = alignedCourse();
    d.assessments[1].coverage[0].bloom = "understand";
    const { container } = renderRoute(CoursePage, pageData(d));
    expect(
      screen.getByText("Eindopdracht toetst LU1 onder het niveau van de leeruitkomst.", {
        exact: false,
      }),
    ).toBeVisible();
    expect(screen.getByText("Let op:")).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("guides an empty course and asks for outcomes first", async () => {
    const { container } = renderRoute(CoursePage, pageData(emptyCourseData()));
    expect(screen.getByText("Nog geen leeruitkomsten.")).toBeVisible();
    expect(
      screen.getByText("Voeg leeruitkomsten en activiteiten of toetsen toe om de matrix te zien."),
    ).toBeVisible();
    expect(screen.getAllByText("Voeg eerst leeruitkomsten toe.").length).toBeGreaterThan(0);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

/** Opens the matrix disclosure of a test, as a user would. */
function openMatrix(name: string) {
  const summary = screen.getByText(name, { selector: "summary" });
  (summary.closest("details") as HTMLDetailsElement).open = true;
}

describe("Course editor — question-level matrix (P26.1)", () => {
  it("shows each test's matrix as a real table with a caption and a total row", async () => {
    const { container } = renderRoute(CoursePage, pageData(itemizedCourse()));
    expect(screen.getByText("Toetsmatrijs (4 vragen)", { exact: false })).toBeVisible();
    openMatrix("Toetsmatrijs (4 vragen)");
    const table = screen.getByRole("table", { name: "Toetsmatrijs: Eindopdracht" });
    for (const name of ["Vraag", "Leeruitkomst", "Denkniveau", "Vraagvorm", "Punten"])
      expect(within(table).getByRole("columnheader", { name })).toHaveAttribute("scope", "col");
    expect(within(table).getByRole("combobox", { name: "Leeruitkomst van vraag 3" })).toHaveValue(
      "lo-2",
    );
    expect(within(table).getByRole("textbox", { name: "Punten van vraag 1" })).toHaveValue("10");
    const total = within(table).getByRole("rowheader", { name: "Totaal" });
    const totalRow = total.closest("tr") as HTMLElement;
    expect(totalRow).toHaveTextContent("4 vragen, 25 punten");
    expect(totalRow).toHaveTextContent("LU1: 80%");
    expect(totalRow).toHaveTextContent("LU2: 20%");
    expect(
      within(table).getByRole("button", { name: /Verwijderen\W+vraag 4/ }),
    ).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("offers a question form that works without JavaScript", () => {
    renderRoute(CoursePage, pageData(itemizedCourse()));
    openMatrix("Toetsmatrijs (4 vragen)");
    const add = screen.getByRole("button", { name: /Vraag toevoegen\W+Eindopdracht/ });
    const form = add.closest("form") as HTMLFormElement;
    expect(form).toHaveAttribute("method", "post");
    expect(form.querySelector('input[name="intent"]')).toHaveValue("add-item");
    expect(form.querySelector('input[name="assessmentId"]')).toHaveValue("test-1");
  });

  it("the coverage matrix counts the questions, and the test form says coverage follows them", () => {
    renderRoute(CoursePage, pageData(itemizedCourse()));
    const table = screen.getByRole("table", {
      name: "Welke activiteit en welke toets dekt welke leeruitkomst",
    });
    const row = within(table).getByRole("rowheader", { name: "LU1" }).closest("tr") as HTMLElement;
    expect(within(row).getAllByRole("cell")[3]).toHaveTextContent("2 vragen");
    expect(
      screen.getAllByText("De dekking volgt uit de toetsmatrijs.", { exact: false }).length,
    ).toBeGreaterThan(0);
  });

  it("names the question in a question-level finding", () => {
    const d = itemizedCourse();
    d.assessments[1].items![1].bloom = "apply";
    renderRoute(CoursePage, pageData(d));
    expect(
      screen.getByText(
        "Vraag 2 van Eindopdracht toetst LU1 onder het niveau van de leeruitkomst.",
        {
          exact: false,
        },
      ),
    ).toBeVisible();
  });
});

describe("Course page — linked work (20.4)", () => {
  it("guides an empty section to the tools and Mijn werk", () => {
    renderRoute(CoursePage, pageData());
    const section = screen.getByRole("region", { name: "Gekoppeld werk" });
    expect(within(section).getByText(/Nog niets gekoppeld/)).toBeVisible();
  });

  it("lists linked work with its tool, item and a way back to Mijn werk", async () => {
    const data = {
      ...pageData(),
      linkedWork: [
        {
          generationId: "g1",
          toolName: { nl: "Authentieke toets ontwerpen", en: "Design an authentic assessment" },
          itemTitle: "Eindopdracht",
          createdAt: new Date("2026-11-05T10:00:00Z"),
        },
      ],
    };
    const { container } = renderRoute(CoursePage, data);
    const section = screen.getByRole("region", { name: "Gekoppeld werk" });
    expect(within(section).getByText("Authentieke toets ontwerpen")).toBeVisible();
    expect(within(section).getByText(/Eindopdracht/)).toBeVisible();
    expect(within(section).getByRole("link", { name: "Bekijk in Mijn werk" })).toHaveAttribute(
      "href",
      "/projects",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
