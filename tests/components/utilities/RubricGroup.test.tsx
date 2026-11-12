import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { RubricGroup } from "~/components/utilities/RubricGroup";
import { groupSummary, rubricRounds, toScore } from "~/lib/utilities/rubric";
import { sampleRubric } from "../../utilities/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

/** P36.1 — Hoe ging de groep: counts per round, worst criterion first, no AI. */
function renderGroup(n: number, locale: "nl" | "en" = "nl", extraRound = false) {
  const d = sampleRubric();
  const scores = Array.from({ length: n }, (_, i) => ({
    month: "2026-11",
    levels: toScore(d, {
      [d.criteria[0]!.id]: d.criteria[0]!.levels[i % 3]!.id,
      [d.criteria[1]!.id]: d.criteria[1]!.levels[0]!.id,
    })!,
  }));
  if (extraRound) scores.push({ month: "2026-09", levels: scores[0]!.levels });
  const rounds = rubricRounds(scores);
  const group = groupSummary(d, scores, "2026-11");
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      loader: () => ({ locale }),
      Component: () => <RubricGroup group={group} rounds={rounds} selected="2026-11" />,
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("RubricGroup", () => {
  it("shows no counts under five closed fill-ins in the round", async () => {
    renderGroup(4);
    expect(await screen.findByRole("heading", { name: "Hoe ging de groep" })).toBeInTheDocument();
    expect(screen.getByText(/Vanaf 5 afgesloten invullingen/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the worst criterion first, with how many works sat on the lowest level", async () => {
    renderGroup(5);
    const tables = await screen.findAllByRole("table");
    // Bronnen: all 5 on the lowest level; Analyse: 2 of 5.
    expect(tables[0]).toHaveAccessibleName("Bronnen: 5 van 5 op het laagste niveau (100%)");
    expect(tables[1]).toHaveAccessibleName("Analyse: 2 van 5 op het laagste niveau (40%)");
    expect(within(tables[1]!).getByRole("row", { name: "Onvoldoende 2" })).toBeInTheDocument();
    expect(screen.getByText(/5 afgesloten invullingen in november 2026/)).toBeInTheDocument();
  });

  it("lets the teacher pick a round, marking the current one", async () => {
    renderGroup(5, "nl", true);
    const nav = await screen.findByRole("navigation", { name: "Ronde" });
    const current = within(nav).getByRole("link", { name: /november 2026/ });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: /september 2026/ })).toHaveAttribute(
      "href",
      "/?round=2026-09",
    );
  });

  it("has no a11y violations (NL and EN)", async () => {
    const { container, unmount } = renderGroup(5, "nl", true);
    await screen.findAllByRole("table");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    unmount();
    const en = renderGroup(2, "en");
    await screen.findByText(/From 5 closed fill-ins/);
    expect((await axe(en.container, axeOpts)).violations).toEqual([]);
  });
});
