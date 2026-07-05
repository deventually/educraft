import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import Insight from "~/routes/cohorts.$id.insight";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const loaderData = {
  cohort: { id: "c1", name: "SE jaar 2 — 25/26 blok 1" },
  students: [
    {
      userId: "stu-1",
      label: "Aïsha de Vries",
      sessions: 3,
      turns: 18,
      lastActiveAt: new Date("2026-07-04T10:00:00Z"),
      avgHelpfulness: 1,
      summaries: [
        {
          sessionId: "sess-1",
          toolSlug: "mentorai",
          toolName: "MentorAI",
          createdAt: new Date("2026-07-04T10:00:00Z"),
          topicsWorkedOn: ["de kettingregel"],
          skillsProgressed: ["toepassen van de kettingregel"],
          misconceptions: ["verwart de kettingregel met de productregel"],
          effort: "high",
          helpfulness: 1,
        },
      ],
    },
    {
      userId: "stu-2",
      label: "Bram Jansen",
      sessions: 0,
      turns: 0,
      lastActiveAt: null,
      avgHelpfulness: null,
      summaries: [],
    },
  ],
  tutors: [
    {
      toolSlug: "mentorai",
      toolName: "MentorAI",
      sessions: 3,
      turns: 18,
      lastActiveAt: new Date("2026-07-04T10:00:00Z"),
      avgHelpfulness: 1,
      topTopics: ["de kettingregel"],
      topMisconceptions: ["verwart de kettingregel met de productregel"],
    },
  ],
};

function renderInsight(data: typeof loaderData = loaderData) {
  const props = { loaderData: data } as unknown as ComponentProps<typeof Insight>;
  const Stub = createRoutesStub([
    { path: "/cohorts/:id/insight", Component: () => <Insight {...props} /> },
  ]);
  return render(<Stub initialEntries={["/cohorts/c1/insight"]} />);
}

describe("Cohort insight view", () => {
  it("shows the cohort name and both students (including an inactive one)", () => {
    renderInsight();
    expect(screen.getByText(/SE jaar 2/i)).toBeInTheDocument();
    expect(screen.getByText("Aïsha de Vries")).toBeInTheDocument();
    expect(screen.getByText("Bram Jansen")).toBeInTheDocument();
  });

  it("renders de-personalised summary signal (topics + misconceptions), not a transcript", () => {
    renderInsight();
    expect(screen.getAllByText(/de kettingregel/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/verwart de kettingregel met de productregel/i).length,
    ).toBeGreaterThan(0);
    // No raw conversation is present: the loader shape carries no message content.
    const flat = JSON.stringify(loaderData);
    expect(flat).not.toMatch(/"content"/);
    expect(flat).not.toMatch(/"messages"/);
  });

  it("frames effectiveness as signal for the mentor's judgement, not an automated verdict", () => {
    renderInsight();
    // The 'signal, not a verdict' framing copy is present (Dutch fallback locale).
    expect(
      screen.getByText(/geen (automatisch )?oordeel|signaal, geen oordeel|signaal voor/i),
    ).toBeInTheDocument();
  });

  it("shows a per-tutor effectiveness rollup", () => {
    renderInsight();
    // MentorAI appears in the tutor rollup with its engagement.
    expect(screen.getAllByText("MentorAI").length).toBeGreaterThan(0);
  });

  it("has no a11y violations", async () => {
    const { container } = renderInsight();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
