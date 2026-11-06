import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import Home from "~/routes/home";

type ToolData = ComponentProps<typeof Home>["loaderData"]["tools"][number];

const tools: ToolData[] = [
  {
    slug: "guided-reflection",
    name: { nl: "Begeleide reflectie", en: "Guided Reflection" },
    tagline: { nl: "Ontwerp een les.", en: "Design a lesson." },
    icon: "compass",
    userType: "instructor",
    mode: "one-shot",
    subtitle: {
      nl: "Begeleide reflectie (Backward Design)",
      en: "Guided Reflection (Backward Design)",
    },
    theory: { nl: "Backward Design", en: "Backward Design" },
    goal: "design",
    search: "begeleide reflectie guided reflection backward design les lesson",
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
  },
];

function renderHome(utilities = true, checkin = false) {
  const props = { loaderData: { tools, utilities, checkin } } as unknown as ComponentProps<
    typeof Home
  >;
  const Stub = createRoutesStub([{ path: "/", Component: () => <Home {...props} /> }]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("Home / tools page", () => {
  it("shows the pilot check-in only when it is due", () => {
    const { unmount } = renderHome(true, false);
    expect(screen.queryByRole("region", { name: /hoe gaat de pilot/i })).toBeNull();
    unmount();
    renderHome(true, true);
    expect(screen.getByRole("region", { name: /hoe gaat de pilot/i })).toBeInTheDocument();
  });

  it("groups tools by teaching goal by default", () => {
    renderHome();
    expect(screen.getByText("Plannen & ontwerpen")).toBeInTheDocument();
    expect(screen.getByText("Zelf leren met een coach")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Begeleide reflectie/ })).toBeInTheDocument();
  });

  it("shows the book name as a subtitle on the card", () => {
    renderHome();
    expect(screen.getByText("Begeleide reflectie (Backward Design)")).toBeInTheDocument();
  });

  it("does not render goals that have no tools", () => {
    renderHome();
    // "Motiveren & activeren" has no tool in this fixture.
    expect(screen.queryByText("Motiveren & activeren")).toBeNull();
  });

  it("shows no technique chips on the cards (P27.3)", () => {
    renderHome();
    expect(screen.queryByText("4 fasen")).toBeNull();
    expect(screen.queryByText("Formulier")).toBeNull();
    expect(screen.queryByText("Gesprek")).toBeNull();
  });

  it("links to earlier work ('Eerder gemaakt', P27.3)", () => {
    renderHome();
    expect(screen.getByRole("link", { name: "Eerder gemaakt" })).toHaveAttribute(
      "href",
      "/projects",
    );
  });

  it("shows full tool titles without clamping or truncating them", () => {
    renderHome();
    const heading = screen.getByRole("heading", { name: /Cognitive Architect/ });
    expect(heading.textContent).toContain("Cognitive Architect");
    // No line-clamp wrapper — the whole title must be visible so users don't have to guess.
    expect(heading.className).not.toMatch(/line-clamp/);
    expect(heading.querySelector('[class*="line-clamp"]')).toBeNull();
  });

  it("collapses to a flat result list when searching", async () => {
    const user = userEvent.setup();
    renderHome();
    await user.type(screen.getByRole("searchbox"), "mentor");
    expect(screen.getByText("1 tool")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Terug naar doel-weergave/ })).toBeInTheDocument();
    expect(screen.queryByText("Plannen & ontwerpen")).toBeNull();
    expect(screen.getByRole("link", { name: /MentorAI/ })).toBeInTheDocument();
  });

  it("offers no audience filter", () => {
    renderHome();
    expect(screen.queryByRole("button", { name: "Voor studenten" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Voor docenten" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Filter op publiek" })).toBeNull();
  });

  it("shows no audience badge on goals or cards", () => {
    renderHome();
    expect(screen.queryByText("Student")).toBeNull();
    expect(screen.queryByText("Docent")).toBeNull();
  });

  it("keeps the audience out of a card's accessible name", () => {
    renderHome();
    const link = screen.getByRole("link", { name: /MentorAI/ });
    expect(link.getAttribute("aria-label")).not.toMatch(/Student/);
  });

  it("offers no type filter and no grid/list switch", () => {
    renderHome();
    expect(screen.queryByRole("button", { name: "Chatbots" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Lijst" })).toBeNull();
  });

  it("does not repeat the theory under a card", () => {
    renderHome();
    expect(screen.queryByText("Science of Learning", { exact: true })).toBeNull();
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

  it("has no 'Hulpmiddelen' section when utilities are off for the user (P28.3)", () => {
    renderHome(false);
    expect(screen.queryByRole("region", { name: "Hulpmiddelen" })).toBeNull();
  });

  it("shows a 'Hulpmiddelen' section below the tools, with a card per utility", () => {
    renderHome();
    const section = screen.getByRole("region", { name: "Hulpmiddelen" });
    expect(
      within(section).getByRole("link", { name: /Punten omrekenen naar een cijfer/ }),
    ).toHaveAttribute("href", "/utilities/grade-calculator");
    expect(within(section).getByRole("link", { name: "Alle hulpmiddelen" })).toHaveAttribute(
      "href",
      "/utilities",
    );
    // Below the goal sections.
    const goals = screen.getByRole("region", { name: "Tools per onderwijsdoel" });
    expect(goals.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("finds the grade calculator with the search box", async () => {
    const user = userEvent.setup();
    renderHome();
    await user.type(screen.getByRole("searchbox"), "cesuur");
    expect(screen.getByText("1 tool")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Punten omrekenen naar een cijfer/ }),
    ).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = renderHome();
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
