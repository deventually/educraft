import { describe, expect, it } from "vitest";
import { render as rtlRender, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { axe } from "vitest-axe";
import { DossierGrill, grillDone, grillPending } from "~/components/portfolio/DossierGrill";
import { nl } from "~/lib/i18n/messages/nl";
import type { GuidedSectionView } from "~/lib/portfolio/guided";
import { C1, C2, LU } from "../portfolio/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };
const LU2 = "00000000-0000-4000-8000-000000000002";

function render(node: React.ReactNode) {
  const Stub = createRoutesStub([{ path: "/", Component: () => node }]);
  return rtlRender(<Stub initialEntries={["/"]} />);
}

const section = (patch: Partial<GuidedSectionView>): GuidedSectionView => ({
  id: "s1",
  title: "Beginsituatie",
  criterionIds: [C2],
  fromOutline: true,
  n: 1,
  covers: [2],
  questions: [],
  answers: [],
  drafted: false,
  ...patch,
});

const outcomes = [
  {
    outcomeId: LU,
    label: "LU1 Doceren",
    sections: [
      section({
        questions: ["Welke groep had je?", "Wat konden ze al?"],
        answers: ["Tweedejaars.", ""],
      }),
      section({ id: "s2", title: "Opbouw van de les", criterionIds: [C1], n: 2, covers: [1] }),
    ],
  },
  {
    outcomeId: LU2,
    label: "LU2 Begeleiden",
    sections: [section({ id: "c3", title: "Je begeleidt een student.", fromOutline: false })],
  },
];

const props = { dossierId: "d1", outcomes, confirmed: true, draftMode: false };

describe("DossierGrill", () => {
  it("offers one Grill me button for the whole dossier", async () => {
    const { container } = render(<DossierGrill {...props} />);
    const region = screen.getByRole("region", { name: "Grill me over het hele dossier" });
    const go = within(region).getByRole("button", { name: "Grill me" });
    expect(go).toHaveAttribute("name", "intent");
    expect(go).toHaveAttribute("value", "grillDossier");
    expect(go).toHaveAccessibleDescription(/alle leeruitkomsten/);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("lists the questions in one list, per learning outcome, with a field for each", () => {
    render(<DossierGrill {...props} />);
    expect(screen.getByRole("heading", { name: "LU1 Doceren" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "LU2 Begeleiden" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Beginsituatie" })).toBeInTheDocument();
    const first = screen.getByRole("textbox", { name: "Welke groep had je?" });
    expect(first).toHaveAttribute("name", `answer:${LU}:s1`);
    expect(first).toHaveValue("Tweedejaars.");
    expect(screen.getByRole("textbox", { name: "Wat konden ze al?" })).toHaveValue("");
    // An outcome without questions yet says so instead of an empty list.
    expect(screen.getAllByText(/Nog geen vragen/)).toHaveLength(1);
    // Every chapter stays one link away.
    expect(
      screen.getByRole("link", { name: "Naar het hoofdstuk van LU1 Doceren" }),
    ).toHaveAttribute("href", `/portfolio/d1/outcome/${LU}?tab=chapter`);
  });

  it("saves the answers on their own", () => {
    render(<DossierGrill {...props} />);
    const save = screen.getByRole("button", { name: "Bewaar je antwoorden" });
    expect(save).toHaveAttribute("value", "saveDossierAnswers");
  });

  it("in coaching mode keeps the answers as notes: no button to write the chapters", () => {
    render(<DossierGrill {...props} />);
    expect(screen.queryByRole("button", { name: "Stel alle hoofdstukken op" })).toBeNull();
    expect(screen.getByText(/naast je hoofdstukken/)).toBeInTheDocument();
  });

  it("in draft mode writes every chapter with one button", async () => {
    const { container } = render(<DossierGrill {...props} draftMode />);
    const write = screen.getByRole("button", { name: "Stel alle hoofdstukken op" });
    expect(write).toHaveAttribute("value", "draftDossier");
    expect(write).toHaveAccessibleDescription(/elk hoofdstuk/);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("without a confirmed framework, points to the framework instead of a button", () => {
    render(<DossierGrill {...props} confirmed={false} />);
    expect(screen.queryByRole("button", { name: "Grill me" })).toBeNull();
    expect(screen.getByRole("link", { name: /kader/ })).toHaveAttribute(
      "href",
      "/portfolio/d1/framework",
    );
  });

  it("after new questions puts focus on the first empty answer, otherwise on the button", () => {
    const { unmount } = render(<DossierGrill {...props} focusAfter="grillDossier" />);
    expect(screen.getByRole("textbox", { name: "Wat konden ze al?" })).toHaveFocus();
    unmount();
    render(<DossierGrill {...props} focusAfter="saveDossierAnswers" />);
    expect(screen.getByRole("button", { name: "Bewaar je antwoorden" })).toHaveFocus();
  });

  it("says how the round and the writing went", () => {
    const t = nl.portfolioGrill;
    const g = nl.portfolioGuided;
    expect(grillPending("grillDossier", t)).toBe(t.pendingGrill);
    expect(grillPending("draftDossier", t)).toBe(t.pendingDraft);
    expect(grillPending("saveDossierAnswers", t)).toBeNull();
    expect(grillDone({ intent: "grillDossier", followUps: 9, failed: 0 }, t, g)).toBe(
      "De coach stelde 9 nieuwe vragen. Beantwoord ze en druk dan weer op Grill me.",
    );
    expect(grillDone({ intent: "grillDossier", followUps: 0 }, t, g)).toBe(t.grillNone);
    expect(grillDone({ intent: "grillDossier", followUps: 2, failed: 1 }, t, g)).toContain(
      "Bij 1 van de onderdelen",
    );
    expect(grillDone({ intent: "draftDossier", drafted: 5, failed: 0 }, t, g)).toBe(
      "5 onderdelen staan in je hoofdstukken. Lees ze na en pas aan waar nodig.",
    );
    expect(grillDone({ intent: "draftDossier", drafted: 3, failed: 1 }, t, g)).toContain(
      "Bij 1 hoofdstuk lukte niet alles",
    );
    expect(grillDone({ intent: "saveDossierAnswers" }, t, g)).toBe(t.saved);
  });
});
