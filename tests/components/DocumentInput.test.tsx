import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { DynamicForm, defaultValuesFor } from "~/components/DynamicForm";
import type { InputField } from "~/lib/registry/types";

// Mock locale + the strings the document control uses.
vi.mock("~/lib/i18n/useT", () => ({
  useLocale: () => "en",
  useT: () => ({
    tool: {
      docUpload: "Upload PDF or Word",
      docExtracting: "Extracting text…",
      docExtracted: "Text extracted — review and edit below.",
      docEmpty: "No text found (is it a scan?). Paste the text below instead.",
      docLarge: "This document is very large; generating may be slow and costly.",
      docSkippedEmpty: "No readable text found in (skipped)",
    },
  }),
}));

// Mock the extractor so the test never touches unpdf/mammoth or real bytes.
const filesToDocumentText = vi.fn();
vi.mock("~/lib/documents/extract", () => ({
  filesToDocumentText: (files: File[]) => filesToDocumentText(files),
  DOC_ACCEPT_ATTR: ".pdf,.docx,application/pdf",
}));

const field: InputField = {
  name: "document",
  label: { nl: "Te beoordelen document", en: "Document to assess" },
  kind: "document",
  required: true,
  rows: 6,
};

function renderField() {
  const onChange = vi.fn();
  const values = defaultValuesFor([field]);
  const utils = render(
    <DynamicForm fields={[field]} values={values} onChange={(_n, v) => onChange(v)} />,
  );
  return { ...utils, onChange };
}

const pdf = (name = "report.pdf") => new File(["x"], name, { type: "application/pdf" });

describe("DocumentInputControl", () => {
  beforeEach(() => {
    filesToDocumentText.mockReset();
  });

  it("renders a labelled textarea and an upload button with no a11y violations", async () => {
    const { container } = renderField();

    const textarea = screen.getByRole("textbox", { name: /Document to assess/i });
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute("id", "f-document");

    const input = screen.getByLabelText("Upload PDF or Word") as HTMLInputElement;
    expect(input).toHaveAttribute("multiple");
    expect(screen.getByRole("button", { name: /Upload PDF or Word/i })).toBeInTheDocument();

    const results = await axe(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("fills the field with extracted text on a successful upload", async () => {
    filesToDocumentText.mockResolvedValue({
      text: "EXTRACTED REPORT TEXT",
      emptyFiles: [],
      large: false,
    });
    const { onChange } = renderField();

    const input = screen.getByLabelText("Upload PDF or Word") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [pdf()] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("EXTRACTED REPORT TEXT"));
    expect(await screen.findByText(/review and edit below/i)).toBeInTheDocument();
  });

  it("merges several files (whole-portfolio case)", async () => {
    filesToDocumentText.mockResolvedValue({
      text: "## a.pdf\n\nAAA\n\n## b.docx\n\nBBB",
      emptyFiles: [],
      large: false,
    });
    const { onChange } = renderField();

    const input = screen.getByLabelText("Upload PDF or Word") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [pdf("a.pdf"), pdf("b.docx")] } });

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith("## a.pdf\n\nAAA\n\n## b.docx\n\nBBB"),
    );
    // The control passes every selected file to the extractor.
    expect(filesToDocumentText.mock.calls[0][0]).toHaveLength(2);
  });

  it("lists files that had no readable text alongside a successful merge", async () => {
    filesToDocumentText.mockResolvedValue({
      text: "## report.pdf\n\nAAA",
      emptyFiles: ["scan.pdf"],
      large: false,
    });
    const { onChange } = renderField();

    const input = screen.getByLabelText("Upload PDF or Word") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [pdf(), pdf("scan.pdf")] } });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(await screen.findByText(/skipped.*scan\.pdf|scan\.pdf/i)).toBeInTheDocument();
  });

  it("shows the paste-instead notice and does not fill when nothing is extracted", async () => {
    filesToDocumentText.mockResolvedValue({ text: "", emptyFiles: ["scan.pdf"], large: false });
    const { onChange } = renderField();

    const input = screen.getByLabelText("Upload PDF or Word") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [pdf("scan.pdf")] } });

    expect(await screen.findByText(/No text found/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("warns when the extracted text is very large", async () => {
    filesToDocumentText.mockResolvedValue({ text: "huge", emptyFiles: [], large: true });
    const { onChange } = renderField();

    const input = screen.getByLabelText("Upload PDF or Word") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [pdf("big.pdf")] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("huge"));
    expect(await screen.findByText(/very large/i)).toBeInTheDocument();
  });

  it("surfaces the error message when extraction throws", async () => {
    filesToDocumentText.mockRejectedValue(new Error("File too large: maximum size is 15 MB."));
    const { onChange } = renderField();

    const input = screen.getByLabelText("Upload PDF or Word") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [pdf("huge.pdf")] } });

    expect(await screen.findByText(/maximum size is 15 MB/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
