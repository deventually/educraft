import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DynamicForm, defaultValuesFor } from "~/components/DynamicForm";
import type { InputField } from "~/lib/registry/types";

vi.mock("~/lib/i18n/useT", () => ({
  useLocale: () => "en",
  useT: () => ({
    tool: {
      docUpload: "Upload PDF or Word",
      docExtracting: "Extracting text…",
      docExtracted: "Text extracted",
      docEmpty: "No text",
      imageUploadLabel: "Upload images",
      imageRemove: "Remove",
      figuresLegend: "Figures from the document",
      figuresLoading: "Looking for figures…",
      figuresNone: "No figures found in the document.",
      figuresPrivacy: "Figures are not anonymised.",
      figuresUnsupported: "{count} skipped",
      figuresMax: "Max {max}",
      figureClose: "Close",
      figureFromFile: "Image {index}",
      figureFromPage: "Figure {index}, page {page}",
      figureZoom: "Enlarge {label}",
      figuresOwnUpload: "Missing a figure? Upload it yourself",
    },
  }),
}));

vi.mock("~/lib/documents/extract", () => ({
  filesToDocumentText: async () => ({ text: "TEXT", emptyFiles: [], large: false }),
  DOC_ACCEPT_ATTR: ".pdf,.docx",
}));

const documentFigures = vi.fn(async (files: File[]) => ({
  figures: [
    {
      source: files[0]!.name,
      page: 2,
      index: 1,
      image: { mediaType: "image/png", dataBase64: "QUFB" },
    },
  ],
  unsupported: 0,
}));
vi.mock("~/lib/documents/figures", () => ({
  documentFigures: (files: File[]) => documentFigures(files),
}));

const fields: InputField[] = [
  { name: "document", label: { nl: "Document", en: "Document" }, kind: "document" },
  {
    name: "figures",
    label: { nl: "Kernfiguren", en: "Key figures" },
    kind: "image",
    accept: "image/png,image/jpeg",
    imagesFrom: "document",
  },
];

describe("DynamicForm — figures from the uploaded document (imagesFrom)", () => {
  it("offers the figures of the uploaded document in the image field", async () => {
    const onChange = vi.fn();
    render(<DynamicForm fields={fields} values={defaultValuesFor(fields)} onChange={onChange} />);
    expect(screen.queryByText("Figures from the document")).not.toBeInTheDocument();

    const pick = screen.getByLabelText("Upload PDF or Word") as HTMLInputElement;
    fireEvent.change(pick, {
      target: { files: [new File(["x"], "report.pdf", { type: "application/pdf" })] },
    });

    fireEvent.click(await screen.findByLabelText("Figure 1, page 2"));
    expect(onChange).toHaveBeenLastCalledWith("figures", [
      { mediaType: "image/png", dataBase64: "QUFB" },
    ]);
  });

  it("still tells the caller about the files, for the document viewer", async () => {
    const onDocumentFiles = vi.fn();
    render(
      <DynamicForm
        fields={fields}
        values={defaultValuesFor(fields)}
        onChange={vi.fn()}
        onDocumentFiles={onDocumentFiles}
      />,
    );
    const file = new File(["x"], "report.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Upload PDF or Word"), { target: { files: [file] } });
    await screen.findByLabelText("Figure 1, page 2");
    expect(onDocumentFiles).toHaveBeenCalledWith("document", [file]);
  });

  it("offers the document's figures first, and own uploads as the fallback below", async () => {
    render(<DynamicForm fields={fields} values={defaultValuesFor(fields)} onChange={vi.fn()} />);
    expect(screen.getByText("Upload images", { selector: "button" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Upload PDF or Word"), {
      target: { files: [new File(["x"], "report.pdf", { type: "application/pdf" })] },
    });
    const picker = await screen.findByRole("group", { name: "Figures from the document" });
    const upload = screen.getByText("Missing a figure? Upload it yourself", { selector: "button" });
    expect(picker.compareDocumentPosition(upload) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
