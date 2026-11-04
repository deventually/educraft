import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import UtilitiesIndex from "~/routes/utilities._index";
import UtilityPage, { resolveUtility } from "~/routes/utilities.$slug";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderAt(Component: React.ComponentType, locale: "nl" | "en" = "nl") {
  const Stub = createRoutesStub([{ id: "root", path: "/", loader: () => ({ locale }), Component }]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("/utilities", () => {
  it("lists every utility as a link", async () => {
    renderAt(UtilitiesIndex);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Hulpmiddelen" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Punten omrekenen naar een cijfer/ })).toHaveAttribute(
      "href",
      "/utilities/grade-calculator",
    );
  });

  it("has no a11y violations (EN)", async () => {
    const { container } = renderAt(UtilitiesIndex, "en");
    await screen.findByRole("heading", { level: 1, name: "Utilities" });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("/utilities/:slug", () => {
  it("returns 404 for an unknown slug", () => {
    expect(() => resolveUtility("nope")).toThrow(
      expect.objectContaining({ status: 404 }) as unknown as Error,
    );
    expect(resolveUtility("grade-calculator").id).toBe("grade-calculator");
  });

  it("renders the grade calculator under its task-first name", async () => {
    const props = { loaderData: { slug: "grade-calculator" } } as unknown as ComponentProps<
      typeof UtilityPage
    >;
    renderAt(() => <UtilityPage {...props} />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Punten omrekenen naar een cijfer" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terug naar hulpmiddelen" })).toHaveAttribute(
      "href",
      "/utilities",
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});
