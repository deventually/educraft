import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import type { ComponentType } from "react";
import PrintRoute from "~/routes/portfolio.$id.print";
import { dossierDoc } from "~/lib/portfolio/export";
import * as edit from "~/lib/portfolio/edit";
import { LU, sampleDossier } from "../portfolio/fixtures";

const NOW = Date.UTC(2026, 10, 20);
// biome-ignore lint/suspicious/noExplicitAny: route components take framework-typed props
const DossierPrintPage = PrintRoute as ComponentType<any>;

function renderPage(draft: boolean) {
  const data = edit.writeChapter(sampleDossier(), LU, "Ik begon. [aanvullen: het effect]");
  const doc = dossierDoc({
    name: "BDB 2026",
    data: draft ? data : sampleDossier(),
    locale: "nl",
    now: NOW,
    draft,
  });
  const Stub = createRoutesStub([
    { path: "/", Component: () => <DossierPrintPage loaderData={{ doc }} /> },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("Dossier print page (PDF)", () => {
  it("opens the print window and shows the dossier with its title page", async () => {
    const print = vi.fn();
    window.print = print;
    const { container } = renderPage(false);
    expect(print).toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1, name: "BDB 2026" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "LU1 Doceren" })).toBeInTheDocument();
    expect(screen.queryByText(/CONCEPT/)).toBeNull();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("cannot be mistaken for the final version: CONCEPT on every page, open spots marked", async () => {
    const print = vi.fn();
    window.print = print;
    const { container } = renderPage(true);
    // Fixed at the top and bottom of every printed page, and large on the title page.
    expect(container.querySelector("[data-print-banner='top']")).toHaveTextContent(
      "CONCEPT, NIET INLEVEREN",
    );
    expect(container.querySelector("[data-print-banner='bottom']")).toHaveTextContent(
      "CONCEPT, NIET INLEVEREN",
    );
    expect(
      screen.getByText(
        "Deze versie heeft nog open plekken, geel gemarkeerd. Lever hem niet in; los eerst alles op in LimeOnIt.",
      ),
    ).toBeInTheDocument();
    expect(container.querySelector("mark")).toHaveTextContent("[aanvullen: het effect]");
    expect((await axe(container)).violations).toEqual([]);
  });
});
