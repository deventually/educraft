import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { RubricInsight } from "~/components/utilities/RubricInsight";
import { levelDistribution, toScore } from "~/lib/utilities/rubric";
import { sampleRubric } from "../../utilities/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderInsight(n: number, locale: "nl" | "en" = "nl") {
  const d = sampleRubric();
  const scores = Array.from(
    { length: n },
    (_, i) =>
      toScore(d, {
        [d.criteria[0]!.id]: d.criteria[0]!.levels[i % 3]!.id,
        [d.criteria[1]!.id]: d.criteria[1]!.levels[i % 2]!.id,
      })!,
  );
  const insight = levelDistribution(d, scores);
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      loader: () => ({ locale }),
      Component: () => <RubricInsight insight={insight} count={n} />,
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("RubricInsight", () => {
  it("shows no counts under five closed fill-ins", async () => {
    renderInsight(4);
    expect(await screen.findByText(/Vanaf 5 afgesloten invullingen/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows a table per criterion from five on", async () => {
    renderInsight(5);
    const table = await screen.findByRole("table", {
      name: "Analyse: hoe vaak elk niveau gekozen is",
    });
    expect(table).toHaveTextContent("Onvoldoende2");
    expect(
      screen.getByText("Op basis van 5 afgesloten invullingen, zonder namen."),
    ).toBeInTheDocument();
  });

  it("has no a11y violations (NL and EN)", async () => {
    const { container, unmount } = renderInsight(5, "nl");
    await screen.findAllByRole("table");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    unmount();
    const en = renderInsight(2, "en");
    await screen.findByText(/From 5 closed fill-ins/);
    expect((await axe(en.container, axeOpts)).violations).toEqual([]);
  });
});
