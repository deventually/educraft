import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { DocumentViewer } from "~/components/documents/DocumentViewer";

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

const pdfDoc = {
  kind: "pdf" as const,
  pages: [
    "Inleiding. De stage vond plaats bij een webshop.",
    "Reflectie: ik heb de klant elke week gesproken over de voortgang.",
  ],
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

  it("falls back to the page text when a page cannot be drawn", async () => {
    render(<DocumentViewer files={[pdf]} text="x" />);
    await waitFor(() => expect(pdfDoc.renderPage).toHaveBeenCalled());
    expect(await screen.findAllByText(/extracted text/i)).not.toHaveLength(0);
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
    expect(screen.getByText("klant", { selector: "mark" })).toBeInTheDocument();
  });

  it("jumps from a quote in the result to the right page", async () => {
    const user = userEvent.setup();
    render(
      <DocumentViewer
        files={[pdf]}
        text="x"
        quotes={["ik heb de klant elke week gesproken", "dit staat nergens in het verslag"]}
      />,
    );
    await screen.findByText("Page 1 of 2");

    const buttons = screen.getAllByRole("button", { name: /show in document/i });
    await user.click(buttons[0]);
    expect(await screen.findByText(/Found on page 2/i)).toBeInTheDocument();
    expect(document.querySelector('[data-located="true"]')).toHaveTextContent("Page 2 of 2");

    // A quote that is not verbatim in the original is said to be not found, never mis-marked.
    await user.click(buttons[1]);
    expect(await screen.findByText(/not found exactly/i)).toBeInTheDocument();
    expect(document.querySelector('[data-located="true"]')).toBeNull();
  });

  it("renders a Word file as a Word view and marks the paragraph of a hit", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DocumentViewer files={[docx]} text="x" quotes={["De opdrachtgever was tevreden"]} />,
    );
    expect(await screen.findByRole("heading", { name: "Bijlage A" })).toBeInTheDocument();
    expect(screen.getByText(/colour and font are lost/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show in document/i }));
    expect(await screen.findByText(/Found and marked/i)).toBeInTheDocument();
    expect(container.querySelector('p[data-located="true"]')).toHaveTextContent(
      "De opdrachtgever was tevreden",
    );
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
});
