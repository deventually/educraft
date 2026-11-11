import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { expectAiCallId } from "../helpers/aiCall";
import { CourseDesignAssessments } from "~/components/courses/CourseDesignAssessments";
import type { ImportProposal } from "~/lib/courses/import";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderStep(opts: { proposal?: ImportProposal | null; notes?: string } = {}) {
  const Stub = createRoutesStub([
    {
      path: "/courses/:id",
      Component: () => (
        <CourseDesignAssessments proposal={opts.proposal ?? null} notes={opts.notes} />
      ),
    },
  ]);
  return render(<Stub initialEntries={["/courses/c1"]} />);
}

const outcome = (n: number, text: string, bloom?: "create" | "apply") => ({
  key: `o${n}`,
  text,
  ...(bloom ? { bloom } : {}),
  verbatim: false,
  existing: true,
  criteria: [],
});

const proposal: ImportProposal = {
  source: "design",
  outcomes: [
    outcome(1, "De student ontwerpt een datamodel.", "create"),
    outcome(2, "De student schrijft SQL-queries.", "apply"),
  ],
  assessments: [
    {
      key: "a1",
      title: "Proeftoets SQL",
      kind: "formative",
      week: 3,
      outcomeKeys: ["o2"],
      existing: false,
      details: { form: "Praktijktoets" },
      parts: [],
    },
    {
      key: "a2",
      title: "Ontwerp webwinkel",
      kind: "summative",
      week: 8,
      weight: 90,
      outcomeKeys: ["o1"],
      existing: false,
      details: { form: "Beroepsproduct met mondelinge toelichting" },
      parts: [],
    },
  ],
  notes: "De weging is een voorstel.",
  weightsOff: true,
  uncovered: ["o2"],
};

describe("CourseDesignAssessments (wizard step 2)", () => {
  it("offers to propose a test programme, with the school's forms optional", async () => {
    const { container } = renderStep();
    const section = screen.getByRole("region", { name: "Volgende stap: het toetsprogramma" });
    const forms = within(section).getByLabelText(
      "Toetsvormen die jullie gebruiken",
    ) as HTMLTextAreaElement;
    expect(forms.required).toBe(false);
    expect(forms.maxLength).toBe(500);
    // Nothing to remark on before there is a proposal.
    expect(within(section).queryByLabelText("Wat moet er anders?")).toBeNull();
    const submit = within(section).getByRole("button", { name: "Toetsprogramma voorstellen" });
    const form = submit.closest("form")!;
    expect((form.querySelector('input[name="intent"]') as HTMLInputElement).value).toBe(
      "design-assessments",
    );
    await expectAiCallId(submit);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows the proposal: tests ticked, weights marked as the AI's, outcomes not repeated", async () => {
    const { container } = renderStep({ proposal });
    const form = screen.getByRole("form", { name: "AI-voorstel" });
    expect(within(form).getByText(/toetsprogramma bij je leeruitkomsten/)).toBeTruthy();
    expect(within(form).getByText("De weging is een voorstel.")).toBeTruthy();
    // The outcomes are the course's own: carried as hidden fields, not as rows to tick.
    expect(within(form).queryByRole("group", { name: "Leeruitkomst 1" })).toBeNull();
    expect(form.querySelectorAll('input[name="outcomeKey"]')).toHaveLength(2);
    const boxes = within(form).getAllByRole("checkbox", { name: "Toevoegen aan de cursus" });
    expect(boxes.map((b) => (b as HTMLInputElement).checked)).toEqual([true, true]);
    const weights = within(form).getAllByLabelText("Weging (voorstel van de AI)");
    expect((weights[1] as HTMLInputElement).value).toBe("90");
    expect(
      within(form).getByText(/Toetsvorm: Beroepsproduct met mondelinge toelichting/),
    ).toBeTruthy();
    expect(within(form).getByText(/De voorgestelde wegingen tellen niet op tot 100%/)).toBeTruthy();
    expect(
      within(form).getByText(/in geen summatieve toets: 2\. De student schrijft SQL-queries\./),
    ).toBeTruthy();
    expect((form.querySelector('input[name="intent"]') as HTMLInputElement).value).toBe(
      "import-apply",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("asks for the Bloom level of each covered outcome, the outcome's own level first", () => {
    renderStep({ proposal });
    const form = screen.getByRole("form", { name: "AI-voorstel" });
    const test2 = within(form).getByRole("group", { name: "Toets 2" });
    const level = within(test2).getByLabelText(
      "Bloom-niveau in deze toets voor leeruitkomst 1",
    ) as HTMLSelectElement;
    expect(level.name).toBe("a2.bloom.o1");
    expect(level.value).toBe("create");
    expect(
      (
        within(test2).getByLabelText(
          "Bloom-niveau in deze toets voor leeruitkomst 2",
        ) as HTMLSelectElement
      ).value,
    ).toBe("apply");
  });

  it("asks again with a remark, sending the earlier proposal along", async () => {
    const { container } = renderStep({ proposal });
    const section = screen.getByRole("region", { name: "Volgende stap: het toetsprogramma" });
    const remark = within(section).getByLabelText("Wat moet er anders?") as HTMLTextAreaElement;
    expect(remark.required).toBe(false);
    expect(remark.maxLength).toBe(500);
    const again = within(section).getByRole("button", { name: "Nieuw voorstel" });
    const form = again.closest("form")!;
    expect(remark.closest("form")).toBe(form);
    const previous = form.querySelector('input[name="previous"]') as HTMLInputElement;
    expect(JSON.parse(previous.value).map((t: { title: string }) => t.title)).toEqual([
      "Proeftoets SQL",
      "Ontwerp webwinkel",
    ]);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows what the AI still needs when it proposed nothing", () => {
    renderStep({ notes: "Welke toetsvormen gebruiken jullie?" });
    const box = screen.getByRole("region", { name: "Opmerkingen van de AI" });
    expect(within(box).getByText("Welke toetsvormen gebruiken jullie?")).toBeTruthy();
    expect(screen.getByLabelText("Toetsvormen die jullie gebruiken")).toBeTruthy();
  });
});
