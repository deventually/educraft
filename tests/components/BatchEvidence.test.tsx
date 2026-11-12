import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub, useActionData } from "react-router";
import { BatchEvidence } from "~/components/portfolio/BatchEvidence";
import type { SortProposal } from "~/lib/portfolio/batch";
import { C1, C2, LU } from "../portfolio/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };
const LU2 = "lu-2";
const C3 = "c-3";

const outcomes = [
  {
    id: LU,
    code: "LU1",
    title: "Doceren",
    criteria: [
      { id: C1, text: "Heldere structuur." },
      { id: C2, text: "Sluit aan bij de beginsituatie." },
    ],
    requiredEvidence: ["Feedback van de werkplekbegeleider", "Opname van de les"],
  },
  {
    id: LU2,
    code: "LU4",
    title: "Toetsen",
    criteria: [{ id: C3, text: "Valide toets." }],
    requiredEvidence: ["Toetsmatrijs"],
  },
];

type Posted = Record<string, string>;

/** Proposals per file name: the first sure, the second to check. */
function propose(files: { key: string; name: string }[]): SortProposal[] {
  return files.map((f) =>
    f.name === "lesplan.txt"
      ? {
          key: f.key,
          title: "Lesplan medicijnrekenen",
          kind: "lesson-plan",
          outcomeId: LU,
          criterionIds: [C1],
          line: "Opname van de les",
          check: false,
          reason: "Een lesplan.",
        }
      : { key: f.key, title: "notities", kind: "other", criterionIds: [], check: true },
  );
}

function renderPage({ confirmed = true, room = 99 } = {}) {
  const posted: Posted[] = [];
  const action = vi.fn(async ({ request }: { request: Request }) => {
    const fd = Object.fromEntries(await request.formData()) as Posted;
    posted.push(fd);
    if (fd.intent === "proposeEvidence")
      return { ok: true, intent: "proposeEvidence", sorted: propose(JSON.parse(fd.files ?? "[]")) };
    return { ok: true, intent: "addEvidenceBatch", added: JSON.parse(fd.items ?? "[]").length };
  });
  function Page() {
    const data = useActionData() as { sorted?: SortProposal[] } | undefined;
    return (
      <BatchEvidence outcomes={outcomes} room={room} confirmed={confirmed} sorted={data?.sorted} />
    );
  }
  const Stub = createRoutesStub([{ path: "/", Component: Page, action }]);
  return { ...render(<Stub initialEntries={["/"]} />), action, posted };
}

const txt = (name: string, text: string) => new File([text], name, { type: "text/plain" });

async function pickTwo() {
  await userEvent.upload(screen.getByLabelText("Kies bestanden"), [
    txt("lesplan.txt", "Lesplan voor 2B. Noor Jansen hielp mee, noor@school.nl."),
    txt("notities.txt", "Wat losse notities."),
  ]);
  await screen.findByText("lesplan.txt");
}

describe("BatchEvidence (adding evidence in one go)", () => {
  it("reads several files in the browser and runs the name check per file", async () => {
    const { container } = renderPage();
    await userEvent.type(
      screen.getByLabelText("Namen van studenten om te vervangen (één per regel)"),
      "Noor Jansen",
    );
    await pickTwo();
    const files = screen.getByRole("list", { name: "Gekozen bestanden" });
    const [first, second] = within(files).getAllByRole("listitem");
    expect(first).toHaveTextContent(
      "Vervangen: Noor Jansen → [STUDENT], noor@school.nl → [E-MAIL-1]",
    );
    expect(second).toHaveTextContent("Geen namen of nummers gevonden");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("sends only the texts with codes for a proposal, never the names", async () => {
    const { posted } = renderPage();
    await userEvent.type(
      screen.getByLabelText("Namen van studenten om te vervangen (één per regel)"),
      "Noor Jansen",
    );
    await pickTwo();
    await userEvent.click(screen.getByRole("button", { name: "Stel voor waar ze horen" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]?.intent).toBe("proposeEvidence");
    const sent = JSON.parse(posted[0]?.files ?? "[]") as { name: string; text: string }[];
    expect(sent.map((f) => f.name)).toEqual(["lesplan.txt", "notities.txt"]);
    expect(sent[0]?.text).toContain("[STUDENT]");
    expect(JSON.stringify(sent)).not.toMatch(/Noor|noor@/);
  });

  it("shows the proposals in one list, with 'Controleren' for doubt and nothing ticked", async () => {
    const { container } = renderPage();
    await pickTwo();
    await userEvent.click(screen.getByRole("button", { name: "Stel voor waar ze horen" }));
    const lesplan = await screen.findByRole("group", { name: "lesplan.txt" });
    const notes = screen.getByRole("group", { name: "notities.txt" });
    expect(lesplan).toHaveTextContent("Voorstel");
    expect(lesplan).toHaveTextContent("Een lesplan.");
    expect(notes).toHaveTextContent("Controleren");
    for (const box of screen.getAllByRole("checkbox", { name: "Toevoegen" }))
      expect(box).not.toBeChecked();
    expect(within(lesplan).getByLabelText("Titel")).toHaveValue("Lesplan medicijnrekenen");
    expect(within(lesplan).getByLabelText("Leeruitkomst")).toHaveValue(LU);
    expect(within(lesplan).getByLabelText("Verplicht bewijs")).toHaveValue("Opname van de les");
    expect(within(lesplan).getByRole("checkbox", { name: "1. Heldere structuur." })).toBeChecked();
    expect(screen.getByRole("button", { name: "Voeg 0 stukken toe" })).toBeDisabled();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("ticks only the sure proposals in one press, and adds just what is ticked", async () => {
    const { posted } = renderPage();
    await pickTwo();
    await userEvent.click(screen.getByRole("button", { name: "Stel voor waar ze horen" }));
    await screen.findByRole("group", { name: "lesplan.txt" });
    await userEvent.click(
      screen.getByRole("button", { name: "Vink de voorstellen zonder twijfel aan" }),
    );
    const [sure, doubt] = screen.getAllByRole("checkbox", { name: "Toevoegen" });
    expect(sure).toBeChecked();
    expect(doubt).not.toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Voeg 1 stuk toe" }));
    await waitFor(() => expect(posted).toHaveLength(2));
    expect(posted[1]?.intent).toBe("addEvidenceBatch");
    expect(JSON.parse(posted[1]?.items ?? "[]")).toEqual([
      {
        title: "Lesplan medicijnrekenen",
        kind: "lesson-plan",
        text: "Lesplan voor 2B. Noor Jansen hielp mee, [E-MAIL-1].",
        outcomeId: LU,
        criterionIds: [C1],
        line: "Opname van de les",
      },
    ]);
  });

  it("choosing another outcome shows its criteria and lines and clears the old ones", async () => {
    renderPage();
    await pickTwo();
    await userEvent.click(screen.getByRole("button", { name: "Stel voor waar ze horen" }));
    const lesplan = await screen.findByRole("group", { name: "lesplan.txt" });
    await userEvent.selectOptions(within(lesplan).getByLabelText("Leeruitkomst"), LU2);
    expect(within(lesplan).getByRole("checkbox", { name: "1. Valide toets." })).not.toBeChecked();
    expect(within(lesplan).queryByText("Heldere structuur.")).toBeNull();
    expect(within(lesplan).getByLabelText("Verplicht bewijs")).toHaveValue("");
  });

  it("asks for a confirmed framework first", () => {
    renderPage({ confirmed: false });
    expect(screen.getByText(/Bevestig eerst je kader/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Kies bestanden")).toBeNull();
  });

  it("says when the dossier has no room for more", async () => {
    renderPage({ room: 1 });
    await pickTwo();
    expect(screen.getByText("Er past nog 1 stuk in je dossier.")).toBeInTheDocument();
  });
});
