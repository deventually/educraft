import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("renders nothing when there is nothing to offer", () => {
    const { container } = show({ nextTools: [], linkTargets: [], dossiers: [] });
    expect(container).toBeEmptyDOMElement();
  });

  it("has no axe violations", async () => {
    const { container } = show();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
