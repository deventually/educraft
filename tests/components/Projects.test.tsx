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

function renderProjects(generations: (typeof gen)[]) {
  // createRoutesStub renders route components without injecting the loaderData
  // prop (that's framework-mode behaviour), so we pass it via a wrapper while
  // still rendering inside the stub's data router (needed for Form/useNavigation).
  const props = { loaderData: { generations } } as unknown as ComponentProps<typeof Projects>;
  const Stub = createRoutesStub([{ path: "/", Component: () => <Projects {...props} /> }]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("Projects page", () => {
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

  it("shows no delete control when there are no generations", () => {
    renderProjects([]);
    expect(screen.queryByRole("button", { name: /verwijder|delete/i })).toBeNull();
  });
});
