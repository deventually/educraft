import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { axe } from "vitest-axe";
import { ExportMenu, ExportPanel } from "~/components/export/ExportMenu";
import { ExportPreview } from "~/components/export/ExportPreview";
import { toExportDoc } from "~/lib/export/doc";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const doc = toExportDoc({
  title: "Toetsvragen maken",
  locale: "nl",
  sections: [
    {
      heading: "1. Toetsmatrijs",
      markdown: "## Overzicht\n\n| Doel | Vragen |\n|---|---|\n| LU1 | **3** |",
    },
    { heading: "2. Toetsvragen", markdown: "1. Wat is een cel?\n2. Noem twee organellen." },
  ],
});

describe("ExportPreview (P30.1)", () => {
  it("shows the result as the file will be: headings, a real table, lists", () => {
    render(<ExportPreview doc={doc} />);
    expect(screen.getByRole("heading", { level: 3, name: "Toetsvragen maken" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 4, name: "1. Toetsmatrijs" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 5, name: "Overzicht" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Doel" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "3" }).querySelector("strong")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows code as a coloured monospace block (code export)", () => {
    const code = toExportDoc({
      title: "Code",
      locale: "nl",
      sections: [{ heading: null, markdown: "```python\ndef f():\n    return 1\n```" }],
    });
    const { container } = render(<ExportPreview doc={code} />);
    const pre = container.querySelector("pre code");
    expect(pre?.textContent).toBe("def f():\n    return 1");
    expect(pre?.querySelector("span[style]")?.getAttribute("style")).toContain("color");
  });

  it("has no axe violations", async () => {
    const { container } = render(<ExportPreview doc={doc} />);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("ExportMenu (P30.1)", () => {
  function show(withIds: string[] = []) {
    const Stub = createRoutesStub([
      {
        path: "/tools/test-items",
        Component: () => <ExportMenu generationId="g2" with={withIds} />,
      },
      {
        path: "/work/:generationId/export",
        loader: ({ request, params }) => ({
          doc,
          downloads: [
            {
              format: "docx",
              href: `/work/${params.generationId}/export/docx${new URL(request.url).search}`,
            },
            { format: "pdf", href: `/work/${params.generationId}/print` },
            { format: "md", href: `/work/${params.generationId}/export/md` },
          ],
        }),
      },
    ]);
    return render(<Stub initialEntries={["/tools/test-items"]} />);
  }

  it("shows a preview first, then offers the download", async () => {
    const { container } = show(["g1"]);
    fireEvent.click(screen.getByText("Exporteer"));
    const details = container.querySelector("details");
    if (details) {
      details.open = true;
      fireEvent(details, new Event("toggle"));
    }
    await waitFor(() => expect(screen.getByRole("region", { name: /Voorbeeld/ })).toBeTruthy());
    expect(screen.getByRole("heading", { name: "Toetsvragen maken" })).toBeTruthy();
    const link = screen.getByRole("link", { name: /Word/ });
    expect(link).toHaveAttribute("href", "/work/g2/export/docx?with=g1");
    expect(link).toHaveAttribute("download");
    // P30.2: PDF goes through the print page in a new tab; Markdown is a plain download.
    const pdf = screen.getByRole("link", { name: /Print of bewaar als PDF/ });
    expect(pdf).toHaveAttribute("href", "/work/g2/print");
    expect(pdf).toHaveAttribute("target", "_blank");
    expect(pdf).not.toHaveAttribute("download");
    expect(screen.getByRole("link", { name: /Markdown/ })).toHaveAttribute("download");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("loads nothing until it is opened", () => {
    show();
    expect(screen.queryByRole("region", { name: /Voorbeeld/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Word/ })).toBeNull();
  });
});

describe("ExportPanel: a lesson plan as slides (P30.4)", () => {
  it("shows the slides as well and offers PowerPoint", async () => {
    const lesson = toExportDoc({
      title: "Les voorbereiden",
      locale: "nl",
      sections: [
        {
          heading: null,
          kind: "slides",
          slides: { opening: "Leerdoel", phases: "Lesverloop", closing: "Terugkomen" },
          markdown: "## Lesverloop\n\n### Afsluiting (5 min)\n\n- Exitvraag",
        },
      ],
    });
    const Stub = createRoutesStub([
      { path: "/tools/lesson-plan", Component: () => <ExportMenu generationId="g3" /> },
      {
        path: "/work/:generationId/export",
        loader: () => ({
          doc: lesson,
          downloads: [{ format: "pptx", href: "/work/g3/export/pptx" }],
        }),
      },
    ]);
    const { container } = render(<Stub initialEntries={["/tools/lesson-plan"]} />);
    const details = container.querySelector("details") as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /PowerPoint \(\.pptx\)/ })).toHaveAttribute(
        "href",
        "/work/g3/export/pptx",
      ),
    );
    const slides = screen.getByRole("region", { name: "Voorbeeld van de dia's" });
    expect(within(slides).getByRole("heading", { name: "Afsluiting (5 min)" })).toBeTruthy();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("lets the teacher choose a PowerPoint template, the standard one first (P30.7b)", async () => {
    const lesson = toExportDoc({
      title: "Les voorbereiden",
      locale: "nl",
      sections: [
        {
          heading: null,
          kind: "slides",
          slides: { opening: "Leerdoel", phases: "Lesverloop", closing: "Terugkomen" },
          markdown: "## Leerdoel\n\nDe student legt uit.",
        },
      ],
    });
    const Stub = createRoutesStub([
      { path: "/tools/lesson-plan", Component: () => <ExportMenu generationId="g3" /> },
      {
        path: "/work/:generationId/export",
        loader: () => ({
          doc: lesson,
          downloads: [{ format: "pptx", href: "/work/g3/export/pptx?with=g1" }],
          templates: [
            { id: "t-own", name: "Eigen.pptx", scope: "own" },
            { id: "t-team", name: "Huisstijl.potx", scope: "team", teamName: "Biologie" },
          ],
        }),
      },
    ]);
    const { container } = render(<Stub initialEntries={["/tools/lesson-plan"]} />);
    const details = container.querySelector("details") as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    const select = await screen.findByRole("combobox", { name: "PowerPoint-sjabloon" });
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["LimeOnIt (standaard)", "Mijn sjabloon: Eigen.pptx", "Biologie: Huisstijl.potx"]);
    const link = () => screen.getByRole("link", { name: /PowerPoint \(\.pptx\)/ });
    expect(link()).toHaveAttribute("href", "/work/g3/export/pptx?with=g1");
    fireEvent.change(select, { target: { value: "t-team" } });
    expect(link()).toHaveAttribute("href", "/work/g3/export/pptx?with=g1&template=t-team");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows no slides for a result that is not slides", async () => {
    const { container } = render(<ExportPreview doc={doc} />);
    expect(container.textContent).not.toContain("Dia 1");
  });
});

describe("ExportPanel: an export of anything with a preview route", () => {
  it("loads the preview from its own url and carries its own label", async () => {
    const Stub = createRoutesStub([
      {
        path: "/courses/c1",
        Component: () => (
          <ExportPanel url="/courses/c1/assessments/t1/export" label="Toetsmatrijs exporteren" />
        ),
      },
      {
        path: "/courses/c1/assessments/t1/export",
        loader: () => ({
          doc,
          downloads: [{ format: "docx", href: "/courses/c1/assessments/t1/export/docx" }],
        }),
      },
    ]);
    const { container } = render(<Stub initialEntries={["/courses/c1"]} />);
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(screen.getByText("Toetsmatrijs exporteren")).toBeTruthy();
    details.open = true;
    fireEvent(details, new Event("toggle"));
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /Word/ })).toHaveAttribute(
        "href",
        "/courses/c1/assessments/t1/export/docx",
      ),
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
