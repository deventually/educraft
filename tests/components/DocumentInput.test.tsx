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
    },
  }),
}));

// Mock the extractor so the test never touches unpdf/mammoth or real bytes.
const fileToText = vi.fn();
vi.mock("~/lib/documents/extract", () => ({
  fileToText: (file: File) => fileToText(file),
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

describe("DocumentInputControl", () => {
  beforeEach(() => {
    fileToText.mockReset();
  });

  it("renders a labelled textarea and an upload button with no a11y violations", async () => {
    const { container } = renderField();

    const textarea = screen.getByRole("textbox", { name: /Document to assess/i });
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute("id", "f-document");

    expect(screen.getByRole("button", { name: /Upload PDF or Word/i })).toBeInTheDocument();

    const results = await axe(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("fills the field with extracted text on a successful upload", async () => {
    fileToText.mockResolvedValue({ text: "EXTRACTED REPORT TEXT", empty: false, large: false });
    const { onChange } = renderField();

    const input = screen.getByLabelText("Upload PDF or Word") as HTMLInputElement;
    const file = new File(["x"], "report.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("EXTRACTED REPORT TEXT"));
    expect(await screen.findByText(/review and edit below/i)).toBeInTheDocument();
  });

  it("shows the paste-instead notice and does not fill on an empty (scanned) file", async () => {
    fileToText.mockResolvedValue({ text: "", empty: true, large: false });
    const { onChange } = renderField();

    const input = screen.getByLabelText("Upload PDF or Word") as HTMLInputElement;
    const file = new File(["x"], "scan.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/No text found/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("warns when the extracted text is very large", async () => {
    fileToText.mockResolvedValue({ text: "huge", empty: false, large: true });
    const { onChange } = renderField();

    const input = screen.getByLabelText("Upload PDF or Word") as HTMLInputElement;
    const file = new File(["x"], "big.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("huge"));
    expect(await screen.findByText(/very large/i)).toBeInTheDocument();
  });

  it("surfaces the error message when extraction throws", async () => {
    fileToText.mockRejectedValue(new Error("File too large: maximum size is 15 MB."));
    const { onChange } = renderField();

    const input = screen.getByLabelText("Upload PDF or Word") as HTMLInputElement;
    const file = new File(["x"], "huge.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/maximum size is 15 MB/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
