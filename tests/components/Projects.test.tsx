import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import Projects from "~/routes/projects._index";

const gen = {
  id: "abcdef12-3456-7890-abcd-ef1234567890",
  toolSlug: "guided-reflection-backward-design",
  toolName: { nl: "Begeleide Reflectie", en: "Guided Reflection" },
  stageId: null,
  model: "claude-sonnet-4-6",
  outputLanguage: "nl",
  outputMarkdown: "# Hallo\n\nInhoud.",
  createdAt: new Date("2026-05-01T10:00:00Z"),
};

type Gen = typeof gen & {
  courseLinks?: { courseId: string; courseName: string; itemTitle: string | null }[];
};
type Target = { courseId: string; courseName: string; items: { id: string; title: string }[] };

function renderProjects(
  generations: Gen[],
  dossiers: { id: string; name: string }[] = [],
  courses: Target[] = [],
) {
  // createRoutesStub renders route components without injecting the loaderData
  // prop (that's framework-mode behaviour), so we pass it via a wrapper while
  // still rendering inside the stub's data router (needed for Form/useNavigation).
  const props = { loaderData: { generations, dossiers, courses } } as unknown as ComponentProps<
    typeof Projects
  >;
  const Stub = createRoutesStub([{ path: "/", Component: () => <Projects {...props} /> }]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("Projects page", () => {
  it("is titled 'Eerder gemaakt' (P27.3)", () => {
    renderProjects([gen]);
    expect(screen.getByRole("heading", { level: 1, name: "Eerder gemaakt" })).toBeInTheDocument();
    expect(screen.getByText("Alles wat je met de tools hebt gemaakt.")).toBeInTheDocument();
  });

  it("renders a delete control for each generation", () => {
    renderProjects([gen]);
    expect(screen.getByRole("button", { name: /verwijder|delete/i })).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = renderProjects([gen]);
    // color-contrast is disabled: happy-dom loads no stylesheet, so axe can't
    // compute real contrast and falsely flags the <summary> (fg == bg).
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("offers 'Toevoegen aan dossier' only when the teacher has a dossier (P25)", async () => {
    renderProjects([gen]);
    expect(screen.queryByRole("button", { name: "Toevoegen aan dossier" })).toBeNull();
    const { container } = renderProjects([gen], [{ id: "d1", name: "Mijn BDB" }]);
    expect(screen.getByRole("button", { name: "Toevoegen aan dossier" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Mijn BDB" })).toHaveValue("d1");
    const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations).toEqual([]);
  });

  it("shows no delete control when there are no generations", () => {
    renderProjects([]);
    expect(screen.queryByRole("button", { name: /verwijder|delete/i })).toBeNull();
  });

  it("guides an empty page to the tools", () => {
    renderProjects([]);
    expect(screen.getByRole("heading", { level: 2, name: "Nog geen werk bewaard" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Kies een tool" })).toHaveAttribute("href", "/tools");
  });

  it("has no a11y violations on the empty page", async () => {
    const { container } = renderProjects([]);
    const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});

describe("Projects page — course links (P20, 20.4)", () => {
  const courses: Target[] = [
    { courseId: "c1", courseName: "SE jaar 2", items: [{ id: "t1", title: "Eindopdracht" }] },
  ];
  const axeOpts = { rules: { "color-contrast": { enabled: false } } };

  it("offers the link form only when the teacher has a course", () => {
    renderProjects([gen]);
    expect(screen.queryByRole("button", { name: "Koppelen" })).toBeNull();
  });

  it("offers each course, and each of its items, as a link target", async () => {
    const { container } = renderProjects([gen], [], courses);
    const select = screen.getByRole("combobox", { name: "Koppel aan cursus" });
    expect(select).toHaveAttribute("name", "target");
    expect(screen.getByRole("option", { name: "SE jaar 2 — hele cursus" })).toHaveValue("c1");
    expect(screen.getByRole("option", { name: "Eindopdracht" })).toHaveValue("c1::t1");
    expect(screen.getByRole("button", { name: "Koppelen" })).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows a badge per linked course and an unlink button", async () => {
    const linked = {
      ...gen,
      courseLinks: [{ courseId: "c1", courseName: "SE jaar 2", itemTitle: "Eindopdracht" }],
    };
    const { container } = renderProjects([linked], [], courses);
    expect(screen.getByText("SE jaar 2 · Eindopdracht")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ontkoppel van SE jaar 2" })).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
