import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { DynamicForm, defaultValuesFor } from "~/components/DynamicForm";
import type { ImageInput } from "~/lib/ai/types";
import type { InputField } from "~/lib/registry/types";

// Mock useLocale to avoid React Router context requirement
vi.mock("~/lib/i18n/useT", () => ({
  useLocale: () => "en",
  useT: () => ({
    tool: {
      fileComingSoon: "File upload coming soon",
      imageUploadLabel: "Upload images",
      imageRemove: "Remove",
      imageFileTooLarge: "File too large",
      imageWrongType: "Wrong file type",
      imagePreview: "Preview",
    },
  }),
}));

describe("DynamicForm — image input", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with file input for image kind", () => {
    const fields: InputField[] = [
      {
        name: "mathImages",
        label: { nl: "Afbeeldingen", en: "Images" },
        kind: "image",
        required: true,
        accept: "image/png,image/jpeg",
      },
    ];

    const values = defaultValuesFor(fields);
    const onChange = vi.fn();

    const { container } = render(
      <DynamicForm fields={fields} values={values} onChange={onChange} />,
    );

    // Find the file input via the hidden input element
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute("accept", "image/png,image/jpeg");
    expect(fileInput).toHaveAttribute("multiple");

    // Verify upload button exists
    const uploadButton = screen.getByRole("button");
    expect(uploadButton).toHaveTextContent("Upload images");
  });

  it("displays preview grid when images are provided via values prop", () => {
    const mockImage: ImageInput = {
      mediaType: "image/png",
      dataBase64:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    };

    const fields: InputField[] = [
      {
        name: "mathImages",
        label: { nl: "Afbeeldingen", en: "Images" },
        kind: "image",
        accept: "image/png,image/jpeg",
      },
    ];

    const values = { mathImages: [mockImage] };
    const onChange = vi.fn();

    render(<DynamicForm fields={fields} values={values} onChange={onChange} />);

    // Verify preview image is displayed
    const preview = screen.getByRole("img", { name: /Preview/i });
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveAttribute("src");
    expect(preview.getAttribute("src")).toContain("data:image/png;base64,");

    // Verify remove button is accessible
    const removeButton = screen.getByRole("button", { name: /Remove image/i });
    expect(removeButton).toBeInTheDocument();
  });

  it("displays image count indicator", () => {
    const mockImages: ImageInput[] = [
      {
        mediaType: "image/png",
        dataBase64: "fake1",
      },
      {
        mediaType: "image/jpeg",
        dataBase64: "fake2",
      },
    ];

    const fields: InputField[] = [
      {
        name: "mathImages",
        label: { nl: "Afbeeldingen", en: "Images" },
        kind: "image",
        accept: "image/png,image/jpeg",
      },
    ];

    const values = { mathImages: mockImages };
    const onChange = vi.fn();

    render(<DynamicForm fields={fields} values={values} onChange={onChange} />);

    // Verify count indicator
    expect(screen.getByText(/2 images uploaded/i)).toBeInTheDocument();
  });

  it("calls onChange when remove button is clicked", () => {
    const mockImages: ImageInput[] = [
      {
        mediaType: "image/png",
        dataBase64: "fake1",
      },
      {
        mediaType: "image/jpeg",
        dataBase64: "fake2",
      },
    ];

    const fields: InputField[] = [
      {
        name: "mathImages",
        label: { nl: "Afbeeldingen", en: "Images" },
        kind: "image",
        accept: "image/png,image/jpeg",
      },
    ];

    const values = { mathImages: mockImages };
    const onChange = vi.fn();

    render(<DynamicForm fields={fields} values={values} onChange={onChange} />);

    // Click remove button
    const removeButtons = screen.getAllByRole("button", { name: /Remove/i });
    removeButtons[0].click();

    // Verify onChange was called with array of 1 image (the second one)
    expect(onChange).toHaveBeenCalledWith("mathImages", [mockImages[1]]);
  });

  it("passes accessibility checks (vitest-axe)", async () => {
    const fields: InputField[] = [
      {
        name: "mathImages",
        label: { nl: "Afbeeldingen", en: "Images" },
        kind: "image",
        accept: "image/png,image/jpeg",
        required: true,
      },
    ];

    const values = defaultValuesFor(fields);
    const onChange = vi.fn();

    const { container } = render(
      <DynamicForm fields={fields} values={values} onChange={onChange} />,
    );

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
