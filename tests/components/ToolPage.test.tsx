import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import ToolPage from "~/routes/tool";
import { getToolBySlug, type Tool } from "~/lib/registry";
import { loc } from "~/lib/i18n/localized";

function renderTool(tool: Tool) {
  const loaderData = {
    tool,
    profiles: [],
    verbatim: tool.stages.map((s) => ({ name: s.name, text: "" })),
    localModels: [],
    catalogModels: [],
    helpOverlay: null,
  };
  const props = { loaderData } as unknown as ComponentProps<typeof ToolPage>;
  const Stub = createRoutesStub([{ path: "/", Component: () => <ToolPage {...props} /> }]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("Tool page", () => {
  for (const slug of ["mentorai", "guided-reflection"]) {
    it(`shows no audience badge next to the title (${slug})`, () => {
      const tool = getToolBySlug(slug)!;
      renderTool(tool);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(loc(tool.name, "nl"));
      expect(screen.queryByText("Student")).toBeNull();
      expect(screen.queryByText("Docent")).toBeNull();
    });

    it(`has no a11y violations (${slug})`, async () => {
      const { container } = renderTool(getToolBySlug(slug)!);
      // Full axe (heading-order included): the setup card sits at h2 under the page h1.
      const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
      expect(results.violations).toEqual([]);
    });
  }

  it("shows the tool's own adaptation text instead of the generic notice (mentorai)", () => {
    const tool = getToolBySlug("mentorai")!;
    renderTool(tool);
    fireEvent.click(screen.getByRole("button", { name: /herkomst|bron|achtergrond|over/i }));
    expect(screen.getByText(/In het boek oefent de lerende één vaste taak/)).toBeInTheDocument();
    expect(screen.queryByText(/interview → één keer genereren/)).toBeNull();
  });

  it("shows an 'improved after measurement' line only when the tool claims one", async () => {
    const base = getToolBySlug("mentorai")!;
    const tool: Tool = {
      ...base,
      attribution: {
        ...base.attribution,
        improvedAfter: {
          date: "2026-11-05",
          report: "evals/reports/2026-11-05.md",
          summary: {
            nl: "geeft onder druk het antwoord niet meer weg",
            en: "no longer gives the answer away",
          },
        },
      },
    };
    const { container } = renderTool(tool);
    fireEvent.click(screen.getByRole("button", { name: /herkomst|bron|achtergrond|over/i }));
    expect(screen.getByText(/Aangescherpt na meting \(2026-11-05\)/)).toBeInTheDocument();
    expect(screen.getByText(/geeft onder druk het antwoord niet meer weg/)).toBeInTheDocument();
    const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});

describe("Tool page: one workspace per kind of tool", () => {
  const cases = [
    { slug: "mentorai", pill: /^Gesprek$/, fills: true },
    { slug: "cognitive-architect", pill: /^4 fasen$/, fills: false },
    { slug: "authentic-assessment", pill: /^Formulier$/, fills: false },
  ];
  for (const { slug, pill, fills } of cases) {
    it(`shows the kind next to the title and sizes the workspace (${slug})`, () => {
      const { container } = renderTool(getToolBySlug(slug)!);
      const heading = screen.getByRole("heading", { level: 1 });
      expect(within(heading.parentElement!).getByText(pill)).toBeInTheDocument();
      const workspace = container.querySelector("#tool-workspace")!;
      expect(workspace.className.includes("flex-1")).toBe(fills);
    });
  }
});
