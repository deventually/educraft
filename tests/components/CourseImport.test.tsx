import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { expectAiCallId } from "../helpers/aiCall";
import { CourseImport } from "~/components/courses/CourseImport";
import type { ImportProposal } from "~/lib/courses/import";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderImport(proposal: ImportProposal | null, startOpen = true, notes?: string) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <CourseImport
          courseName="Databases"
          startOpen={startOpen}
          proposal={proposal}
          notes={notes}
        />
      ),
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

const proposal: ImportProposal = {
  outcomes: [
    {
      key: "o1",
      text: "Je schrijft SQL-queries.",
      bloom: "apply",
      verbatim: true,
      existing: false,
      criteria: [],
    },
    { key: "o2", text: "Je beheert een server.", verbatim: false, existing: false, criteria: [] },
    {
      key: "o3",
      text: "Je ontwerpt een datamodel.",
      verbatim: true,
      existing: true,
      criteria: [],
    },
  ],
  assessments: [
    {
      key: "a1",
      title: "Tentamen",
      kind: "summative",
      weight: 60,
      week: 8,
      outcomeKeys: ["o1"],
      existing: false,
      details: {},
      parts: [],
    },
  ],
  notes: "Het document noemt ook een herkansing.",
  weightsOff: true,
};

describe("CourseImport", () => {
  it("offers the document text, a file and the course name; the file stays in the browser", async () => {
    const { container } = renderImport(null);
    expect(screen.getByText("Importeren uit bestaande documenten")).toBeVisible();
    expect(screen.getByText(/toetsmatrijs of nakijkmodel/)).toBeVisible();
    expect(screen.getByLabelText("Tekst van het document")).toBeRequired();
    expect(screen.getByLabelText("Naam van het vak in het document")).toHaveValue("Databases");
    const file = screen.getByLabelText(/Of kies de bestanden/);
    expect(file).toHaveAttribute("type", "file");
    expect(file).toHaveAttribute("multiple");
    expect(screen.getByText("Kies bestand")).toBeVisible();
    expect(screen.getByText(/niet bewaard/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Voorstel maken" })).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("sends a call id with the proposal request, so leaving can stop it", async () => {
    renderImport(null);
    await expectAiCallId(screen.getByRole("button", { name: "Voorstel maken" }));
  });

  it("shows the proposal: verbatim items ticked, the rest marked and off", async () => {
    const { container } = renderImport(proposal, false);
    const review = screen.getByRole("form", { name: "Voorstel" });

    const lu1 = within(review).getByRole("group", { name: "Leeruitkomst 1" });
    expect(within(lu1).getByRole("checkbox", { name: "Toevoegen aan de cursus" })).toBeChecked();
    expect(within(lu1).getByLabelText("Leeruitkomst")).toHaveValue("Je schrijft SQL-queries.");
    expect(within(lu1).getByLabelText("Bloom-niveau (voorstel van de AI)")).toHaveDisplayValue(
      "toepassen",
    );

    const lu2 = within(review).getByRole("group", { name: "Leeruitkomst 2" });
    expect(
      within(lu2).getByRole("checkbox", { name: "Toevoegen aan de cursus" }),
    ).not.toBeChecked();
    expect(within(lu2).getByText(/Controleer dit/)).toBeVisible();

    const lu3 = within(review).getByRole("group", { name: "Leeruitkomst 3" });
    expect(within(lu3).queryByRole("checkbox")).toBeNull();
    expect(within(lu3).getByText(/Staat al in je cursus/)).toBeVisible();

    const toets = within(review).getByRole("group", { name: "Toets 1" });
    expect(within(toets).getByRole("checkbox", { name: "Toevoegen aan de cursus" })).toBeChecked();
    expect(within(toets).getByLabelText("Titel")).toHaveValue("Tentamen");
    expect(within(toets).getByLabelText("Soort")).toHaveDisplayValue("Summatief");
    expect(within(toets).getByLabelText("Weging (%)")).toHaveValue("60");
    expect(within(toets).getByLabelText("Week")).toHaveValue("8");
    expect(within(toets).getByRole("checkbox", { name: /Je schrijft SQL-queries/ })).toBeChecked();

    expect(within(review).getByText(/tellen niet op tot 100%/)).toBeVisible();
    expect(within(review).getByText("Het document noemt ook een herkansing.")).toBeVisible();
    expect(within(review).getByRole("button", { name: "Gekozen items toevoegen" })).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows the AI's explanation when the document had nothing to import", async () => {
    const why = "Dit is een domeinbeschrijving; er staan geen vakken in.";
    const { container } = renderImport(null, false, why);
    const box = screen.getByRole("region", { name: "Opmerkingen van de AI" });
    expect(box).toBeVisible();
    expect(within(box).getByText(why)).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows what a test blueprint and a marking model add, and sends it along", async () => {
    const documents: ImportProposal = {
      module: { code: "DB1", studyYear: "2026-2027", leader: "Docent A", literature: "Boek A" },
      outcomes: [
        {
          key: "o1",
          text: "Je ontwerpt een datamodel.",
          verbatim: true,
          existing: false,
          criteria: [
            { code: "S-An 1.1", text: "De student registreert requirements.", verbatim: true },
            { text: "De student verzint iets.", verbatim: false },
          ],
        },
        {
          key: "o2",
          text: "Je legt normaliseren uit.",
          verbatim: true,
          existing: true,
          criteria: [{ text: "Legt uit.", verbatim: true }],
        },
      ],
      assessments: [
        {
          key: "a1",
          title: "Eindopdracht",
          outcomeKeys: ["o1"],
          existing: false,
          details: { owner: "Docent A", grading: "pass-fail", passMark: 75 },
          parts: [
            {
              title: "Datamodel",
              outcomeKeys: ["o1"],
              weight: 60,
              knockOut: true,
              pass: "Het model werkt.",
              verbatim: true,
            },
          ],
        },
        {
          key: "a2",
          title: "Tentamen",
          outcomeKeys: [],
          existing: true,
          details: { passMark: 55 },
          parts: [],
        },
      ],
      weightsOff: false,
    };
    const { container } = renderImport(documents, false);
    const review = screen.getByRole("form", { name: "Voorstel" });

    const module = within(review).getByRole("group", { name: "Module" });
    expect(
      within(module).getByRole("checkbox", { name: "Modulegegevens overnemen" }),
    ).toBeChecked();
    expect(within(module).getByLabelText("Modulecode")).toHaveValue("DB1");
    expect(within(module).getByLabelText("Studiejaar")).toHaveValue("2026-2027");
    expect(within(module).getByLabelText("Moduleleider")).toHaveValue("Docent A");
    expect(within(module).getByLabelText("Literatuur")).toHaveValue("Boek A");
    expect(within(module).getByLabelText("Studiefase")).toHaveValue("");
    expect(within(module).getByLabelText("Examinator(en)")).toHaveAttribute(
      "name",
      "module.examiners",
    );
    expect(within(module).getByLabelText("Inhoudelijke beschrijving")).toHaveAttribute(
      "name",
      "module.description",
    );

    const lu1 = within(review).getByRole("group", { name: "Leeruitkomst 1" });
    const criteria = within(lu1).getByRole("list", { name: "Succescriteria" });
    expect(
      within(criteria).getByText("S-An 1.1 De student registreert requirements."),
    ).toBeVisible();
    expect(within(criteria).getByText(/De student verzint iets\./)).toHaveTextContent("controleer");
    const extra = review.querySelector('input[name="o1.extra"]') as HTMLInputElement;
    expect(JSON.parse(extra.value).criteria).toHaveLength(2);

    // An outcome the course has: tick to fill in its criteria when it has none.
    const lu2 = within(review).getByRole("group", { name: "Leeruitkomst 2" });
    expect(within(lu2).getByRole("checkbox", { name: "Lege velden aanvullen" })).toBeChecked();

    const toets = within(review).getByRole("group", { name: "Toets 1" });
    expect(within(toets).getByText("Toetseigenaar: Docent A")).toBeVisible();
    expect(within(toets).getByText("Cesuur: 75%")).toBeVisible();
    const parts = within(toets).getByRole("list", { name: "Onderdelen" });
    expect(within(parts).getByText(/Datamodel/)).toHaveTextContent(
      "Datamodel · Leeruitkomsten: 1 · Weging: 60% · Knock-out: ja",
    );
    const aExtra = review.querySelector('input[name="a1.extra"]') as HTMLInputElement;
    expect(JSON.parse(aExtra.value).parts[0].title).toBe("Datamodel");

    const bestaand = within(review).getByRole("group", { name: "Toets 2" });
    expect(within(bestaand).getByRole("checkbox", { name: "Lege velden aanvullen" })).toBeChecked();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
