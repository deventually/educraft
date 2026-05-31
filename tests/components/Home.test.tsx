import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import Home from "~/routes/home";

type ToolData = ComponentProps<typeof Home>["loaderData"]["tools"][number];

const tools: ToolData[] = [
  {
    slug: "begeleide-reflectie",
    name: { nl: "Begeleide reflectie", en: "Guided Reflection" },
    tagline: { nl: "Ontwerp een les.", en: "Design a lesson." },
    icon: "compass",
    userType: "instructor",
    mode: "one-shot",
    theory: { nl: "Backward Design", en: "Backward Design" },
    goal: "design",
    search: "begeleide reflectie guided reflection backward design les lesson",
    stages: 1,
  },
  {
    slug: "cognitive-architect",
    name: { nl: "Cognitive Architect", en: "Cognitive Architect" },
    tagline: { nl: "Vier fasen.", en: "Four stages." },
    icon: "layers",
    userType: "instructor",
    mode: "one-shot",
    theory: { nl: "Science of Learning", en: "Science of Learning" },
    goal: "design",
    search: "cognitive architect gagné rosenshine",
    stages: 4,
  },
  {
    slug: "mentorai",
    name: { nl: "MentorAI", en: "MentorAI" },
    tagline: { nl: "Een leermeester.", en: "A mentor." },
    icon: "brain",
    userType: "student",
    mode: "chat",
    theory: { nl: "Cognitief Leermeesterschap", en: "Cognitive Apprenticeship" },
    goal: "coach",
    search: "mentorai mentor leermeester apprenticeship coaching",
    stages: 1,
  },
];

function renderHome() {
  const props = { loaderData: { tools } } as unknown as ComponentProps<typeof Home>;
  const Stub = createRoutesStub([{ path: "/", Component: () => <Home {...props} /> }]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("Home / tools page", () => {
  it("groups tools by teaching goal by default", () => {
    renderHome();
    expect(screen.getByText("Plannen & ontwerpen")).toBeInTheDocument();
    expect(screen.getByText("Begeleiden & coachen")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Begeleide reflectie/ })).toBeInTheDocument();
  });

  it("does not render goals that have no tools", () => {
    renderHome();
    // "Motiveren & activeren" has no tool in this fixture.
    expect(screen.queryByText("Motiveren & activeren")).toBeNull();
  });

  it("shows the multi-stage chip only for multi-stage tools", () => {
    renderHome();
    expect(screen.getByText("4 fasen")).toBeInTheDocument();
  });

  it("collapses to a flat result list when a filter is applied", async () => {
    const user = userEvent.setup();
    renderHome();
    // Filter to students → goal sections disappear, flat results + count appear.
    await user.click(screen.getByRole("button", { name: "Voor studenten", pressed: false }));
    expect(screen.getByText("1 tool")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Terug naar doel-weergave/ })).toBeInTheDocument();
    expect(screen.queryByText("Plannen & ontwerpen")).toBeNull();
    expect(screen.getByRole("link", { name: /MentorAI/ })).toBeInTheDocument();
  });

  it("searches across keywords, not just the name", async () => {
    const user = userEvent.setup();
    renderHome();
    await user.type(screen.getByRole("searchbox"), "gagné");
    expect(screen.getByText("1 tool")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cognitive Architect/ })).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", async () => {
    const user = userEvent.setup();
    renderHome();
    await user.type(screen.getByRole("searchbox"), "zzzznotathing");
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("0 tools")).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = renderHome();
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
