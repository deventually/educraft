import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { DossierNoteEditor } from "~/components/courses/DossierNoteEditor";
import type { DossierNote } from "~/lib/courses/dossierNote";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };
const NUMBERS = "| Vraag | p | Rir |\n| --- | --- | --- |\n| V2 | 0,25 | -0,08 |";

function renderEditor({
  analysis = NUMBERS as string | null,
  note = "",
  draft = null as DossierNote | null,
} = {}) {
  const posted: Record<string, string>[] = [];
  const action = vi.fn(async ({ request }: { request: Request }) => {
    posted.push(Object.fromEntries(await request.formData()) as Record<string, string>);
    return { ok: true };
  });
  const Stub = createRoutesStub([
    {
      path: "/",
      action,
      Component: () => (
        <DossierNoteEditor
          analysis={analysis}
          note={note}
          draft={draft}
          models={[]}
          privacy={{ known: { colleagues: [] }, never: [] }}
        />
      ),
    },
  ]);
  return { ...render(<Stub initialEntries={["/"]} />), posted };
}

const draft: DossierNote = {
  draft: "Vraag 2 onderscheidt slecht: de Rir is -0,08.",
  questions: ["Wat ga jij aan vraag 2 veranderen?"],
  dropped: 1,
};

// Seam: the rendered forms; the name check runs in the browser before anything leaves.
describe("DossierNoteEditor (P35.2)", () => {
  it("lets the teacher write and save their own note", async () => {
    const { container, posted } = renderEditor({ note: "Mijn eerdere tekst." });
    const field = screen.getByLabelText("Jouw toelichting bij de toetsanalyse");
    expect(field).toHaveValue("Mijn eerdere tekst.");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    fireEvent.change(field, { target: { value: "Vraag 2 herschrijf ik." } });
    fireEvent.click(screen.getByRole("button", { name: "Toelichting opslaan" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toEqual({ intent: "save-note", note: "Vraag 2 herschrijf ik." });
  });

  it("asks for a concept only after the overview, and sends the numbers held back", async () => {
    const { container, posted } = renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Concept laten schrijven" }));
    const overview = screen.getByRole("region", { name: "Kijk na wat er naar de AI gaat" });
    expect(posted).toHaveLength(0);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    fireEvent.click(within(overview).getByRole("button", { name: "Versturen" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ intent: "draft-note" });
    expect(posted[0]?.analysis).toBeUndefined();
  });

  it("without a linked analysis, says how to get one and offers no concept", () => {
    renderEditor({ analysis: null });
    expect(screen.getByText(/Koppel eerst een toetsanalyse aan deze toets/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Concept laten schrijven" })).toBeNull();
    expect(screen.getByLabelText("Jouw toelichting bij de toetsanalyse")).toBeEnabled();
  });

  it("shows a concept as a concept, with the reflection questions, to take over and rewrite", async () => {
    const { container } = renderEditor({ draft, note: "" });
    const concept = screen.getByRole("region", { name: "Concept van de AI" });
    expect(within(concept).getByText(/Herschrijf het in je eigen woorden/)).toBeVisible();
    expect(
      within(concept).getByText("Vraag 2 onderscheidt slecht: de Rir is -0,08."),
    ).toBeVisible();
    expect(within(concept).getByText("Wat ga jij aan vraag 2 veranderen?")).toBeVisible();
    expect(within(concept).getByText(/1 zin weggelaten/)).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    const field = screen.getByLabelText("Jouw toelichting bij de toetsanalyse");
    expect(field).toHaveValue("");
    fireEvent.click(within(concept).getByRole("button", { name: "Neem over om te herschrijven" }));
    expect(field).toHaveValue("Vraag 2 onderscheidt slecht: de Rir is -0,08.");
    expect(field).toHaveFocus();
  });
});
