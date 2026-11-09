import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { DocumentViewer } from "~/components/documents/DocumentViewer";
import { gridBlowoutRisks } from "../helpers/layout";
import { pageLayout } from "~/lib/documents/pdfLayout";

vi.mock("~/lib/i18n/useT", async () => {
  const { messages } = await import("~/lib/i18n");
  return { useT: () => messages.en, useLocale: () => "en" };
});

// The loader is mocked so the test controls pages and blocks; the real loader is
// covered in tests/documents/original.test.ts.
const loadOriginal = vi.fn();
vi.mock("~/lib/documents/original", () => ({
  loadOriginal: (file: File) => loadOriginal(file),
}));

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const pdf = new File(["%PDF"], "verslag.pdf", { type: "application/pdf" });
const docx = new File(["PK"], "bijlage.docx", {
  type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
});

const pageTexts = [
  "Inleiding. De stage vond plaats bij een webshop.",
  "Reflectie: ik heb de klant elke week gesproken over de voortgang.",
];
// One text item per page, on a 600 x 800 page, 700 points from the bottom.
const layouts = pageTexts.map((str) =>
  pageLayout(
    [{ str, x: 50, y: 700, width: 500, height: 12, fontSize: 12, hasEOL: false }],
    [0, 0, 600, 800],
  ),
);

const pdfDoc = {
  kind: "pdf" as const,
  pages: pageTexts,
  layouts,
  renderPage: vi.fn().mockRejectedValue(new Error("no canvas in tests")),
};

const docxDoc = {
  kind: "docx" as const,
  nodes: [
    {
      type: "element" as const,
      tag: "h1",
      children: [{ type: "text" as const, text: "Bijlage A" }],
    },
    {
      type: "element" as const,
      tag: "p",
      children: [
        { type: "text" as const, text: "De opdrachtgever was tevreden over het prototype." },
      ],
    },
  ],
};

describe("DocumentViewer", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    loadOriginal.mockReset();
    loadOriginal.mockImplementation(async (f: File) =>
      f.name.endsWith(".pdf") ? pdfDoc : docxDoc,
    );
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("shows the original and the text for the AI as two named regions, with tabs", async () => {
    const { container } = render(<DocumentViewer files={[pdf]} text="TEXT FOR THE AI" />);

    expect(await screen.findByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Original" })).toBeInTheDocument();
    const ai = screen.getByRole("region", { name: "What the AI receives" });
    expect(within(ai).getByText("TEXT FOR THE AI")).toBeInTheDocument();

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Original", "What the AI receives"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");

    // Says honestly that the original is not stored.
    expect(screen.getByText(/not stored/i)).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("switches tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<DocumentViewer files={[pdf]} text="x" />);
    await screen.findByText("Page 1 of 2");
    await user.click(screen.getByRole("tab", { name: "Original" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "What the AI receives" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("falls back to the page text when a page cannot be drawn, and marks a hit in it", async () => {
    const quote = "ik heb de klant elke week gesproken";
    const { rerender } = render(<DocumentViewer files={[pdf]} text="x" />);
    await waitFor(() => expect(pdfDoc.renderPage).toHaveBeenCalled());
    expect(await screen.findAllByText(/extracted text/i)).not.toHaveLength(0);

    rerender(<DocumentViewer files={[pdf]} text="x" focus={{ quote, id: 1 }} />);
    await screen.findByText(/Found on page 2/i);
    const page = document.querySelector<HTMLElement>('[data-located="true"]');
    await waitFor(() =>
      expect(page?.querySelector("mark[data-highlight]")).toHaveTextContent(quote),
    );
  });

  it("searches the original and names the page of the hit", async () => {
    const user = userEvent.setup();
    render(<DocumentViewer files={[pdf]} text="x" />);
    await screen.findByText("Page 1 of 2");

    await user.type(
      screen.getByRole("searchbox", { name: /search the original/i }),
      "klant{Enter}",
    );
    expect(await screen.findByText(/Match 1 of 1.*page 2/i)).toBeInTheDocument();
    // Marked in the status line and in the page itself.
    expect(screen.getAllByText("klant", { selector: "mark" })).toHaveLength(2);
  });

  it("jumps to a quote asked for from the result, and reports which quotes it can find", async () => {
    const found = "ik heb de klant elke week gesproken";
    const missing = "dit staat nergens in het verslag";
    const onFoundQuotes = vi.fn();
    const props = { files: [pdf], text: "x", quotes: [found, missing], onFoundQuotes };
    loadOriginal.mockResolvedValue({ ...pdfDoc, renderPage: async () => "data:image/png;x" });
    const { rerender } = render(<DocumentViewer {...props} />);
    await screen.findByText("Page 1 of 2");
    // Only a quote that is really in the original may become a button in the result.
    await waitFor(() => expect(onFoundQuotes).toHaveBeenLastCalledWith([found]));
    // The result holds the buttons now; the viewer no longer repeats them in a list.
    expect(screen.queryByRole("button", { name: /show in document/i })).toBeNull();

    rerender(<DocumentViewer {...props} focus={{ quote: found, id: 1 }} />);
    expect(await screen.findByText(/Found on page 2/i)).toBeInTheDocument();
    expect(document.querySelector('[data-located="true"]')).toHaveTextContent("Page 2 of 2");
    // The passage itself is marked on the page, where its words are, not just the page.
    const page = document.querySelector<HTMLElement>('[data-located="true"]');
    const marks = page?.querySelectorAll<HTMLElement>("[data-highlight]") ?? [];
    expect(marks).toHaveLength(1);
    const at = pageTexts[1]!.indexOf(found);
    expect(Number.parseFloat(marks[0]!.style.left)).toBeCloseTo(
      ((50 + 500 * (at / pageTexts[1]!.length)) / 600) * 100,
    );
    expect(Number.parseFloat(marks[0]!.style.top)).toBeCloseTo(((800 - 700 - 12) / 800) * 100);

    // Asking again for the same quote (a second click) works again.
    rerender(<DocumentViewer {...props} focus={{ quote: missing, id: 2 }} />);
    expect(await screen.findByText(/not found exactly/i)).toBeInTheDocument();
    rerender(<DocumentViewer {...props} focus={{ quote: found, id: 3 }} />);
    expect(await screen.findByText(/Found on page 2/i)).toBeInTheDocument();
  });

  it("renders a Word file as a Word view and marks the paragraph of a hit", async () => {
    const quote = "De opdrachtgever was tevreden";
    const highlights = new Map<string, { ranges: Range[] }>();
    vi.stubGlobal(
      "Highlight",
      class {
        ranges: Range[];
        constructor(...ranges: Range[]) {
          this.ranges = ranges;
        }
      },
    );
    vi.stubGlobal("CSS", { escape: CSS.escape, highlights });
    const { container, rerender } = render(
      <DocumentViewer files={[docx]} text="x" quotes={[quote]} />,
    );
    expect(await screen.findByRole("heading", { name: "Bijlage A" })).toBeInTheDocument();
    expect(screen.getByText(/colour and font are lost/i)).toBeInTheDocument();

    rerender(<DocumentViewer files={[docx]} text="x" quotes={[quote]} focus={{ quote, id: 1 }} />);
    expect(await screen.findByText(/Found and marked/i)).toBeInTheDocument();
    expect(container.querySelector('p[data-located="true"]')).toHaveTextContent(
      "De opdrachtgever was tevreden",
    );
    // The words themselves are highlighted in the paragraph (CSS Custom Highlight).
    expect(highlights.get("document-hit")?.ranges.map((r) => r.toString())).toEqual([quote]);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("offers a file picker when several files were uploaded", async () => {
    const user = userEvent.setup();
    render(<DocumentViewer files={[pdf, docx]} text="x" />);
    await screen.findByText("Page 1 of 2");
    await user.selectOptions(screen.getByRole("combobox", { name: "File" }), "1");
    expect(await screen.findByRole("heading", { name: "Bijlage A" })).toBeInTheDocument();
  });

  it("says so when a file cannot be shown, without breaking", async () => {
    loadOriginal.mockRejectedValue(new Error("broken"));
    render(<DocumentViewer files={[docx]} text="x" />);
    expect(await screen.findByText(/cannot be shown/i)).toBeInTheDocument();
  });

  it("never sends the file over the network", async () => {
    render(
      <DocumentViewer files={[pdf]} text="x" quotes={["ik heb de klant elke week gesproken"]} />,
    );
    await screen.findByText("Page 1 of 2");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("keeps a wide Word table and a long link inside the page", async () => {
    const { container } = render(<DocumentViewer files={[docx]} text="x" />);
    await screen.findByRole("heading", { name: "Bijlage A" });
    const original = screen.getByRole("region", { name: "Original" });
    // The columns never grow to the document's width…
    expect(gridBlowoutRisks(original, container)).toEqual([]);
    // …a table wider than the pane scrolls inside the pane, and a long word or link wraps.
    const pane = original.querySelector("[tabindex='0']");
    expect(pane?.className).toMatch(/\boverflow-auto\b/);
    expect(pane?.className).toMatch(/\bmin-w-0\b/);
    expect(container.querySelector(".md")?.className).toMatch(/\[overflow-wrap:break-word\]/);
  });

  it("keeps its hidden screen-reader text inside the viewer, so the page does not grow", async () => {
    const { container } = render(<DocumentViewer files={[pdf]} text="x" />);
    await screen.findByText("Page 1 of 2");
    const root = container.firstElementChild as HTMLElement;
    // An absolutely positioned (sr-only) element is placed against its nearest positioned
    // ancestor; without one inside the viewer it lands far down the page and stretches it.
    const hidden = Array.from(root.querySelectorAll(".sr-only"));
    expect(hidden.length).toBeGreaterThan(0);
    for (const el of hidden) {
      let anchor: Element | null = el.parentElement;
      while (anchor && !anchor.className.toString().split(/\s+/).includes("relative")) {
        if (anchor === root) {
          anchor = null;
          break;
        }
        anchor = anchor.parentElement;
      }
      expect(anchor, el.outerHTML.slice(0, 80)).not.toBeNull();
    }
  });

  it("zooms the pages of a PDF in and out, and back to 100%", async () => {
    const user = userEvent.setup();
    const { container } = render(<DocumentViewer files={[pdf]} text="x" />);
    await screen.findByText("Page 1 of 2");
    const zoom = screen.getByRole("group", { name: "Zoom" });
    const pages = () => container.querySelector<HTMLElement>("[data-zoom-target]");
    expect(pages()?.style.width).toBe("100%");

    await user.click(within(zoom).getByRole("button", { name: "Zoom in" }));
    expect(pages()?.style.width).toBe("125%");
    await user.click(within(zoom).getByRole("button", { name: /125%/ }));
    expect(pages()?.style.width).toBe("100%");

    const out = within(zoom).getByRole("button", { name: "Zoom out" });
    await user.click(out);
    await user.click(out);
    expect(pages()?.style.width).toBe("50%");
    expect(out).toBeDisabled();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("draws the pages again, sharper, when zoomed in", async () => {
    const user = userEvent.setup();
    const renderPage = vi.fn(async (_n: number, width: number) => `data:image/png;w=${width}`);
    loadOriginal.mockResolvedValue({ ...pdfDoc, renderPage });
    const { container } = render(<DocumentViewer files={[pdf]} text="x" />);
    await screen.findByText("Page 1 of 2");
    await waitFor(() => expect(renderPage).toHaveBeenCalledWith(1, expect.any(Number)));
    const first = Math.max(...renderPage.mock.calls.filter(([n]) => n === 1).map(([, w]) => w));

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    await waitFor(() => {
      const widths = renderPage.mock.calls.filter(([n]) => n === 1).map(([, w]) => w);
      expect(Math.max(...widths)).toBeGreaterThan(first);
    });
    // The sharper drawing replaces the blurry one.
    await waitFor(() => {
      const img = container.querySelector<HTMLImageElement>("figure img");
      expect(img?.getAttribute("src")).not.toBe(`data:image/png;w=${first}`);
    });
  });

  it("zooms a Word view so its text grows and still wraps", async () => {
    const user = userEvent.setup();
    const { container } = render(<DocumentViewer files={[docx]} text="x" />);
    await screen.findByRole("heading", { name: "Bijlage A" });
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(container.querySelector<HTMLElement>("[data-zoom-target]")?.style.zoom).toBe("1.5");
  });
});
