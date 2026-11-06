import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { axe } from "vitest-axe";
import { ExportMenu } from "~/components/export/ExportMenu";
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
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("loads nothing until it is opened", () => {
    show();
    expect(screen.queryByRole("region", { name: /Voorbeeld/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Word/ })).toBeNull();
  });
});
