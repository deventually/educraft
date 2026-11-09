import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import type { SafeNode } from "~/lib/documents/docxHtml";

const text = (t: string): SafeNode => ({ type: "text", text: t });
const el = (tag: string, t: string): SafeNode => ({
  type: "element",
  tag: tag as never,
  children: [text(t)],
});

const nodes = vi.hoisted(() => ({ current: [] as unknown[] }));
vi.mock("~/lib/documents/docxHtml", () => ({
  docxToSafeNodes: vi.fn(async () => {
    if (!nodes.current.length) throw new Error("not a docx");
    return nodes.current;
  }),
}));

import { WordImport } from "~/components/portfolio/WordImport";
import { LU, sampleDossier } from "../portfolio/fixtures";

function renderImport(onPost: (fd: FormData) => void) {
  const d = sampleDossier();
  d.chapters = [{ id: "c", outcomeId: LU, text: "Oude tekst.", aiDrafted: false }];
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <WordImport
          outcomes={d.framework.outcomes}
          chapters={d.chapters}
          references={d.references}
        />
      ),
      action: async ({ request }) => {
        onPost(await request.formData());
        return { ok: true };
      },
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

const pick = () =>
  fireEvent.change(screen.getByLabelText(/Word-bestand/), {
    target: { files: [new File(["x"], "BDB (concept).docx")] },
  });

describe("WordImport", () => {
  it("shows what changed per chapter and takes over only what the teacher ticks", async () => {
    const outcome = sampleDossier().framework.outcomes[0];
    nodes.current = [
      el("p", "CONCEPT, NIET INLEVEREN"),
      el("h1", `${outcome!.code} ${outcome!.title}`),
      el("p", "Nieuwe tekst uit Word."),
      el("h1", "Bronnenlijst"),
      el("p", "Biggs, J. (2011). Teaching."),
      el("h1", "Mijn eigen kop"),
    ];
    const posted: FormData[] = [];
    const { container } = renderImport((fd) => posted.push(fd));
    pick();

    const take = await screen.findByRole("checkbox", {
      name: new RegExp(`Overnemen.*${outcome!.code}`),
    });
    expect(take).not.toBeChecked();
    expect(screen.getByText(/Anders dan in LimeOnIt/)).toBeInTheDocument();
    expect(screen.getByText(/Mijn eigen kop/)).toBeInTheDocument();
    const source = screen.getByRole("checkbox", { name: /Biggs/ });
    expect(source).not.toBeChecked();
    // Nothing is chosen yet, so nothing can be taken over.
    const submit = screen.getByRole("button", { name: /Neem het gekozen over/ });
    expect(submit).toBeDisabled();
    expect(
      (await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations,
    ).toEqual([]);

    fireEvent.click(take);
    fireEvent.click(submit);
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]!.get("intent")).toBe("importChapters");
    expect(JSON.parse(String(posted[0]!.get("chapters")))).toEqual([
      { outcomeId: LU, text: "Nieuwe tekst uit Word." },
    ]);
    expect(posted[0]!.getAll("reference")).toEqual([]);
  });

  it("says so when the file cannot be read, or holds no chapter", async () => {
    nodes.current = [];
    renderImport(() => {});
    pick();
    expect(await screen.findByText(/kon niet gelezen worden/)).toBeInTheDocument();

    nodes.current = [el("h1", "Iets anders"), el("p", "tekst")];
    pick();
    expect(await screen.findByText(/Geen hoofdstuk gevonden/)).toBeInTheDocument();
  });
});
