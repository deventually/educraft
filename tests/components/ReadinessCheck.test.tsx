import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { ReadinessCheck, ReadinessSummaryLink } from "~/components/portfolio/ReadinessCheck";
import { ToastProvider } from "~/components/Toast";
import * as edit from "~/lib/portfolio/edit";
import { readinessCheck } from "~/lib/portfolio/readiness";
import type { DossierData } from "~/lib/portfolio/types";
import { C1, C2, EV, LU, sampleDossier } from "../portfolio/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };
const ID = "dossier-1";
const NOW = Date.UTC(2026, 10, 5);

function renderCheck(d: DossierData, action = vi.fn(async () => ({ ok: true }))) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <ToastProvider>
          <ReadinessSummaryLink items={readinessCheck(d)} />
          <ReadinessCheck dossierId={ID} items={readinessCheck(d)} framework={d.framework} />
        </ToastProvider>
      ),
      action,
    },
  ]);
  return { ...render(<Stub initialEntries={["/"]} />), action };
}

/** Acceptance case 1: one criterion without evidence and too many words. */
function twoRedPoints(): DossierData {
  let d = sampleDossier();
  d = edit.updateOutcome(d, LU, { requiredEvidence: ["Feedback van de werkplekbegeleider"] });
  d = edit.setStatus(d, C2, "shown");
  d = edit.writeChapter(d, LU, Array.from({ length: 120 }, () => "woord").join(" "));
  d = edit.confirmFramework(d, NOW);
  return d;
}

describe("ReadinessCheck", () => {
  it("lists every point with an icon and text, and a 'Los op' link to where you fix it", async () => {
    const { container } = renderCheck(twoRedPoints());
    const section = screen.getByRole("region", { name: "Klaar om in te leveren?" });
    expect(section).toHaveAttribute("id", "readiness");
    expect(
      within(section).getByText("Nog 3 punten open, waarvan 2 blokkerend."),
    ).toBeInTheDocument();

    const noEvidence = within(section)
      .getByText(/Nog geen bewijs bij/)
      .closest("li")!;
    expect(noEvidence).toHaveTextContent("Nog doen");
    expect(noEvidence).toHaveTextContent("De les sluit aan bij de beginsituatie.");
    expect(noEvidence).toHaveTextContent("LU1 Doceren");
    expect(within(noEvidence).getByRole("link", { name: /Los op/ })).toHaveAttribute(
      "href",
      `/portfolio/${ID}/outcome/${LU}?tab=evidence#evidence-title`,
    );

    const words = within(section)
      .getByText(/120 woorden/)
      .closest("li")!;
    expect(words).toHaveTextContent("Nog doen");
    expect(within(words).getByRole("link", { name: /Los op/ })).toHaveAttribute(
      "href",
      `/portfolio/${ID}/outcome/${LU}?tab=chapter#chapter-${LU}`,
    );

    // Green points say so in words too.
    const confirmed = within(section).getByText("Je kader is bevestigd.").closest("li")!;
    expect(confirmed).toHaveTextContent("In orde");
    expect(within(confirmed).queryByRole("link")).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("says 'Alles klaar' when nothing is open, and the export link disappears", () => {
    let d = sampleDossier();
    d = edit.updateOutcome(d, LU, { requiredEvidence: [] });
    d = edit.setStatus(d, C2, "shown");
    d = edit.updateEvidence(d, EV, { criterionIds: [C1, C2] });
    d = edit.confirmFramework(d, NOW);
    d = { ...d, readiness: { ticked: { "no-student-names": NOW } } };
    renderCheck(d);
    expect(screen.getByText("Alles klaar om in te leveren.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /punten open/ })).toBeNull();
  });

  it("puts the same summary above the export as a link to the check", () => {
    renderCheck(twoRedPoints());
    expect(
      screen.getByRole("link", { name: "Nog 3 punten open, waarvan 2 blokkerend." }),
    ).toHaveAttribute("href", "#readiness");
  });

  it("a self-check is a checkbox that saves itself; ticked shows the date", async () => {
    const user = userEvent.setup();
    const { action } = renderCheck(twoRedPoints());
    const box = screen.getByRole("checkbox", {
      name: "Er staan geen namen van studenten in je bewijs",
    });
    expect(box).not.toBeChecked();
    await user.click(box);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const [{ request }] = action.mock.calls[0] as unknown as [{ request: Request }];
    const fd = await request.formData();
    expect(Object.fromEntries(fd)).toEqual({
      intent: "tickReadiness",
      code: "no-student-names",
      ticked: "on",
    });
    expect(await screen.findByText("Opgeslagen.")).toBeInTheDocument();
  });

  it("shows when a self-check was ticked", async () => {
    const d = { ...twoRedPoints(), readiness: { ticked: { "no-student-names": NOW } } };
    const { container } = renderCheck(d);
    expect(
      screen.getByRole("checkbox", { name: "Er staan geen namen van studenten in je bewijs" }),
    ).toBeChecked();
    expect(screen.getByText("Zelf afgevinkt op 5 nov 2026")).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
