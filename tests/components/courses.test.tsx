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
import { alignedCourse } from "../courses/fixtures";

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
