import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { DayPlan } from "~/components/portfolio/DayPlan";
import * as edit from "~/lib/portfolio/edit";
import { dayPlan } from "~/lib/portfolio/plan";
import type { DossierData } from "~/lib/portfolio/types";
import { LU, sampleDossier } from "../portfolio/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };
const ID = "dossier-1";
const TODAY = "2026-11-12";

const confirmed = () => edit.confirmFramework(sampleDossier(), 1);

function renderPlan(d: DossierData, hoursPerDay?: number) {
  const plan = dayPlan(d, TODAY, hoursPerDay);
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <DayPlan dossierId={ID} plan={plan} outcomes={d.framework.outcomes} today={TODAY} />
      ),
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("the day plan", () => {
  it("says how many hours are left and lays them out over working days", async () => {
    const { container } = renderPlan(confirmed(), 1);
    const plan = screen.getByRole("region", { name: "Dagplan" });
    expect(
      within(plan).getByText("Nog ongeveer 5 uur werk: 5 werkdagen van 1 uur."),
    ).toBeInTheDocument();
    const days = within(plan).getByRole("list", { name: "Dagen van het plan" });
    const items = within(days).getAllByRole("listitem", { name: /^Dag/ });
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveAccessibleName(/^Dag 1, vandaag/);
    expect(within(items[0]!).getByRole("link", { name: "LU1 Doceren" })).toHaveAttribute(
      "href",
      `/portfolio/${ID}/outcome/${LU}`,
    );
    expect(within(items[0]!).getByRole("link", { name: "Afronden" })).toHaveAttribute(
      "href",
      `/portfolio/${ID}?tab=finish`,
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("says whether the plan fits before the hand-in date", () => {
    renderPlan({ ...confirmed(), deadline: "2026-11-17" }, 1);
    expect(screen.getByText(/Je komt 2 werkdagen tekort/)).toBeInTheDocument();
  });

  it("is on track when there are enough working days", () => {
    renderPlan({ ...confirmed(), deadline: "2026-11-20" });
    expect(screen.getByText(/Je ligt op schema: je hebt 6 werkdagen/)).toBeInTheDocument();
    expect(screen.getByText(/één werkdag van 8 uur/)).toBeInTheDocument();
  });

  it("asks to request the evidence from others today", () => {
    renderPlan(confirmed());
    const ask = screen.getByRole("heading", { name: "Vraag vandaag aan" }).parentElement!;
    expect(within(ask).getByText(/Opname van de les/)).toBeInTheDocument();
  });

  it("shows its fixed rates and where to change the planning", () => {
    renderPlan(confirmed());
    expect(screen.getByText("Hoe LimeOnIt rekent")).toBeInTheDocument();
    expect(
      screen.getByText(/Per criterium of verplicht bewijsstuk zonder bewijs: 15 minuten/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Planning aanpassen" })).toHaveAttribute(
      "href",
      `/portfolio/${ID}/start?step=planning`,
    );
  });

  it("writes half hours the Dutch way", () => {
    const d = confirmed();
    const plan = dayPlan(d, TODAY);
    plan.minutes = 90;
    const Stub = createRoutesStub([
      {
        path: "/",
        Component: () => (
          <DayPlan dossierId={ID} plan={plan} outcomes={d.framework.outcomes} today={TODAY} />
        ),
      },
    ]);
    render(<Stub initialEntries={["/"]} />);
    expect(screen.getByText(/Nog ongeveer 1,5 uur werk/)).toBeInTheDocument();
  });

  it("says one hour, not one hours, in English", async () => {
    const d = confirmed();
    const plan = dayPlan(d, TODAY, 1);
    const Stub = createRoutesStub([
      {
        id: "root",
        path: "/",
        loader: () => ({ locale: "en" }),
        HydrateFallback: () => null,
        Component: () => (
          <DayPlan dossierId={ID} plan={plan} outcomes={d.framework.outcomes} today={TODAY} />
        ),
      },
    ]);
    render(<Stub initialEntries={["/"]} />);
    expect(
      await screen.findByText("About 5 hours of work left: 5 working days of 1 hour."),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/: 1 hour$/).length).toBeGreaterThan(0);
  });
});
