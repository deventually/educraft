import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import UtilitiesIndex from "~/routes/utilities._index";
import UtilityPage, { resolveUtility } from "~/routes/utilities.$slug";
import RubricList from "~/routes/utilities.rubric._index";

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

describe("/utilities/rubric", () => {
  type ListProps = ComponentProps<typeof RubricList>;
  const renderList = (rubrics: ListProps["loaderData"]["rubrics"], locale: "nl" | "en" = "nl") => {
    const props = { loaderData: { rubrics } } as unknown as ListProps;
    return renderAt(() => <RubricList {...props} />, locale);
  };

  it("shows an empty state with one action", async () => {
    renderList([]);
    expect(await screen.findByRole("heading", { name: "Nog geen rubrics" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Nieuwe rubric" })).toHaveLength(1);
  });

  it("lists rubrics with their size", async () => {
    renderList([
      { id: "r1", name: "Verslag", criteria: 2, maxPoints: 5, updatedAt: "2026-11-04T10:00:00Z" },
    ]);
    const link = await screen.findByRole("link", { name: /Verslag/ });
    expect(link).toHaveAttribute("href", "/utilities/rubric/r1");
    expect(link).toHaveTextContent("2 criteria, maximaal 5 punten");
  });

  it("has no a11y violations (EN)", async () => {
    const { container } = renderList(
      [{ id: "r1", name: "Report", criteria: 2, maxPoints: 5, updatedAt: "2026-11-04T10:00:00Z" }],
      "en",
    );
    await screen.findByRole("heading", { level: 1, name: "Make and keep rubrics" });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
