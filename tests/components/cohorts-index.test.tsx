import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import CohortsIndex from "~/routes/cohorts._index";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderIndex(rows: Array<Record<string, unknown>>) {
  const props = { loaderData: { rows } } as unknown as ComponentProps<typeof CohortsIndex>;
  const Stub = createRoutesStub([
    { path: "/cohorts", Component: () => <CohortsIndex {...props} /> },
  ]);
  return render(<Stub initialEntries={["/cohorts"]} />);
}

const baseRow = {
  id: "c1",
  name: "SE jaar 2",
  toolCount: 2,
  memberCount: 5,
  pendingRemovals: 0,
  activeUntil: null,
};

describe("Cohorts index (P14 removal badge)", () => {
  it("flags a cohort with pending removal requests", () => {
    renderIndex([{ ...baseRow, pendingRemovals: 2 }]);
    const item = screen.getByRole("listitem");
    expect(within(item).getByText(/verwijderverzoek|removal request/i)).toBeInTheDocument();
  });

  it("shows no removal badge when there are none pending", () => {
    renderIndex([baseRow]);
    expect(screen.queryByText(/verwijderverzoek|removal request/i)).not.toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = renderIndex([{ ...baseRow, pendingRemovals: 1 }]);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
