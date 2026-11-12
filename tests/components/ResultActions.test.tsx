import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { axe } from "vitest-axe";
import { ResultActions, type ResultActionsProps } from "~/components/ResultActions";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const base: ResultActionsProps = {
  generationId: "gen-1",
  courseId: "",
  nextTools: [
    { slug: "rubric-builder", name: { nl: "Rubric maken", en: "Build a rubric" } },
    { slug: "test-analysis", name: { nl: "Toetsanalyse", en: "Test analysis" } },
  ],
  linkTargets: [
    { courseId: "c1", courseName: "SE jaar 2", items: [{ id: "t1", title: "Eindtoets" }] },
  ],
  dossiers: [
    {
      id: "d1",
      name: "Mijn BDB",
      criteria: [{ id: "k1", label: "LU1 · De les heeft een heldere structuur" }],
    },
  ],
};

function show(props: Partial<ResultActionsProps> = {}) {
  const Stub = createRoutesStub([
    { path: "/tools/test-items", Component: () => <ResultActions {...base} {...props} /> },
  ]);
  return render(<Stub initialEntries={["/tools/test-items"]} />);
}

describe("ResultActions (P27.1)", () => {
  it("links to the next steps", () => {
    show();
    expect(screen.getByRole("link", { name: /Rubric maken/ })).toHaveAttribute(
      "href",
      "/tools/rubric-builder",
    );
    expect(screen.getByRole("link", { name: /Toetsanalyse/ })).toBeTruthy();
  });

  it("carries the chosen course into the next step", () => {
    show({ courseId: "c1" });
    expect(screen.getByRole("link", { name: /Rubric maken/ })).toHaveAttribute(
      "href",
      "/tools/rubric-builder?course=c1",
    );
  });

  it("says where the result is kept when it came from a course", () => {
    show({ courseId: "c1" });
    expect(screen.getByText(/Bewaard bij SE jaar 2/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Bewaar bij cursus/ })).toBeNull();
  });

  it("links to the place in the course where the kept result shows", () => {
    show({ courseId: "c1" });
    expect(screen.getByRole("link", { name: "Bekijk in de cursus" })).toHaveAttribute(
      "href",
      "/courses/c1?tab=documents#linked-work",
    );
  });

  it("offers to keep the result at a course and to use it as evidence", () => {
    show();
    expect(screen.getByRole("combobox", { name: "Cursus" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Bewaar bij cursus/ })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: /Dossier en criterium/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /heldere structuur/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Gebruik als bewijs/ })).toBeTruthy();
  });

  it("without saved work it only shows the next steps", () => {
    show({ generationId: null });
    expect(screen.getByRole("link", { name: /Rubric maken/ })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers the export for saved work (P30.1)", () => {
    show({ nextTools: [], linkTargets: [], dossiers: [] });
    expect(screen.getByText("Exporteer")).toBeTruthy();
  });

  it("renders nothing when there is nothing to offer", () => {
    const { container } = show({
      generationId: null,
      nextTools: [],
      linkTargets: [],
      dossiers: [],
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("asks for pilot feedback under every saved result, even with nothing else to offer", () => {
    show({ nextTools: [], linkTargets: [], dossiers: [] });
    expect(screen.getByText("Was dit nuttig?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nuttig" })).toBeTruthy();
  });

  it("asks no feedback before the result is saved", () => {
    show({ generationId: null });
    expect(screen.queryByText("Was dit nuttig?")).toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = show();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("ResultActions: keep a lesson plan as a lesson of the course", () => {
  it("offers to add the kept work as a lesson, with a title", async () => {
    const { container } = show({ courseId: "c1", asLesson: true });
    const button = screen.getByRole("button", { name: "Neem op als les" });
    const form = button.closest("form");
    expect(form?.querySelector('input[name="intent"]')).toHaveValue("addAsLesson");
    expect(form?.querySelector('input[name="id"]')).toHaveValue("gen-1");
    expect(form?.querySelector('input[name="courseId"]')).toHaveValue("c1");
    expect(screen.getByRole("textbox", { name: "Titel van de les" })).toBeRequired();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("does not offer it for work that is no lesson, before it is kept, or when it is at a lesson already", () => {
    show({ courseId: "c1" });
    expect(screen.queryByRole("button", { name: "Neem op als les" })).toBeNull();
    cleanup();
    show({ asLesson: true });
    expect(screen.queryByRole("button", { name: "Neem op als les" })).toBeNull();
    cleanup();
    show({ courseId: "c1", itemId: "t1", asLesson: true });
    expect(screen.queryByRole("button", { name: "Neem op als les" })).toBeNull();
  });
});

describe("ResultActions from a dossier criterion (P27.2)", () => {
  const forCriterion = {
    dossierId: "d1",
    dossierName: "Mijn BDB",
    outcomeId: "o1",
    criterionId: "k1",
    criterionText: "De les heeft een heldere structuur",
  };

  it("offers one button that puts the result at that criterion", async () => {
    const { container } = show({ forCriterion });
    const button = screen.getByRole("button", { name: "Zet bij dit criterium" });
    const form = button.closest("form");
    expect(form?.querySelector('input[name="intent"]')).toHaveValue("addToDossier");
    expect(form?.querySelector('input[name="id"]')).toHaveValue("gen-1");
    expect(form?.querySelector('input[name="dossierId"]')).toHaveValue("d1");
    expect(form?.querySelector('input[name="criterionId"]')).toHaveValue("k1");
    expect(screen.queryByLabelText("Dossier en criterium")).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("offers nothing before the result is saved", () => {
    show({ forCriterion, generationId: null });
    expect(screen.queryByRole("button", { name: "Zet bij dit criterium" })).toBeNull();
  });
});
