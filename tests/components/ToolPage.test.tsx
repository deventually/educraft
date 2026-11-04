import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
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
});
