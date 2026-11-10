import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { DocumentFigurePicker } from "~/components/documents/DocumentFigurePicker";
import type { ImageInput } from "~/lib/ai/types";
import type { DocFigures } from "~/lib/documents/figures";

vi.mock("~/lib/i18n/useT", () => ({
  useLocale: () => "en",
  useT: () => ({
    tool: {
      figuresLegend: "Figures from the document",
      figuresLoading: "Looking for figures…",
      figuresNone: "No figures found in the document.",
      figuresPrivacy: "Figures are not anonymised.",
      figuresUnsupported: "{count} image(s) in a format the AI cannot read were skipped.",
      figuresMax: "Maximum of {max} images reached.",
      figureClose: "Close",
      figureFromFile: "Image {index}",
      figureFromPage: "Figure {index}, page {page}",
      figureZoom: "Enlarge {label}",
    },
  }),
}));

const documentFigures = vi.fn<(files: File[]) => Promise<DocFigures>>();
vi.mock("~/lib/documents/figures", () => ({
  documentFigures: (files: File[]) => documentFigures(files),
}));

const img = (s: string): ImageInput => ({ mediaType: "image/png", dataBase64: s });
const FIGS: DocFigures = {
  figures: [
    { source: "report.docx", index: 1, image: img("QUFB") },
    { source: "report.pdf", page: 4, index: 2, image: img("QkJC") },
  ],
  unsupported: 1,
};
const files = [new File(["x"], "report.docx")];

describe("DocumentFigurePicker", () => {
  beforeEach(() => {
    documentFigures.mockReset();
    documentFigures.mockResolvedValue(FIGS);
  });

  it("shows nothing before a document is uploaded", () => {
    const { container } = render(<DocumentFigurePicker files={[]} value={[]} onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    expect(documentFigures).not.toHaveBeenCalled();
  });

  it("offers each figure unticked, with its source and the privacy warning", async () => {
    render(<DocumentFigurePicker files={files} value={[]} onChange={vi.fn()} />);
    const boxes = await screen.findAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    for (const box of boxes) expect(box).not.toBeChecked();
    expect(screen.getByLabelText("Image 1")).toHaveAccessibleDescription("report.docx");
    expect(screen.getByLabelText("Figure 2, page 4")).toHaveAccessibleDescription("report.pdf");
    expect(screen.getByText("Figures are not anonymised.")).toBeInTheDocument();
    expect(
      screen.getByText("1 image(s) in a format the AI cannot read were skipped."),
    ).toBeInTheDocument();
  });

  it("adds a ticked figure to the images and removes it when unticked", async () => {
    const onChange = vi.fn();
    const own = img("T1dO");
    const { rerender } = render(
      <DocumentFigurePicker files={files} value={[own]} onChange={onChange} />,
    );
    fireEvent.click(await screen.findByLabelText("Figure 2, page 4"));
    expect(onChange).toHaveBeenLastCalledWith([own, FIGS.figures[1]!.image]);

    rerender(
      <DocumentFigurePicker
        files={files}
        value={[own, FIGS.figures[1]!.image]}
        onChange={onChange}
      />,
    );
    const box = screen.getByLabelText("Figure 2, page 4");
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(onChange).toHaveBeenLastCalledWith([own]);
  });

  it("enlarges a figure on click, without ticking it, and closes again", async () => {
    const onChange = vi.fn();
    render(<DocumentFigurePicker files={files} value={[]} onChange={onChange} />);
    fireEvent.click(await screen.findByRole("button", { name: "Enlarge Figure 2, page 4" }));
    const dialog = screen.getByRole("dialog", { name: "Figure 2, page 4" });
    expect(dialog).toHaveAttribute("open");
    expect(within(dialog).getByRole("img", { name: "Figure 2, page 4" })).toHaveAttribute(
      "src",
      "data:image/png;base64,QkJC",
    );
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cannot tick more once the maximum is reached", async () => {
    const full = Array.from({ length: 10 }, (_, i) => img(`RlVMT${i}`));
    render(<DocumentFigurePicker files={files} value={full} onChange={vi.fn()} />);
    for (const box of await screen.findAllByRole("checkbox")) expect(box).toBeDisabled();
    expect(screen.getByText("Maximum of 10 images reached.")).toBeInTheDocument();
  });

  it("says so when the document has no figures", async () => {
    documentFigures.mockResolvedValue({ figures: [], unsupported: 0 });
    render(<DocumentFigurePicker files={files} value={[]} onChange={vi.fn()} />);
    expect(await screen.findByText("No figures found in the document.")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <DocumentFigurePicker files={files} value={[]} onChange={vi.fn()} />,
    );
    await screen.findAllByRole("checkbox");
    await waitFor(async () => expect((await axe(container)).violations).toEqual([]));
  });

  it("has no axe violations with a figure enlarged", async () => {
    const { container } = render(
      <DocumentFigurePicker files={files} value={[]} onChange={vi.fn()} />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Enlarge Image 1" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await waitFor(async () => expect((await axe(container)).violations).toEqual([]));
  });
});
