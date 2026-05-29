import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { DynamicForm, defaultValuesFor } from "~/components/DynamicForm";
import type { InputField } from "~/lib/registry/types";

// Mock useLocale to avoid React Router context requirement
vi.mock("~/lib/i18n/useT", () => ({
  useLocale: () => "en",
  useT: () => ({
    tool: {
      fileComingSoon: "File upload coming soon",
    },
  }),
}));

describe("DynamicForm", () => {
  it("renders with label/control association and passes accessibility checks", async () => {
    const fields: InputField[] = [
      {
        name: "studentName",
        label: { nl: "Naam student", en: "Student name" },
        kind: "text",
        required: true,
        placeholder: { nl: "Voornaam en achternaam", en: "First and last name" },
      },
      {
        name: "topic",
        label: { nl: "Onderwerp", en: "Topic" },
        kind: "textarea",
        required: true,
        rows: 4,
      },
    ];

    const values = defaultValuesFor(fields);
    const onChange = () => {};

    const { container } = render(
      <DynamicForm fields={fields} values={values} onChange={onChange} />,
    );

    // Assert label/control association
    const nameInput = screen.getByRole("textbox", { name: /Student name/i });
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveAttribute("id", "f-studentName");

    const topicTextarea = screen.getByRole("textbox", { name: /Topic/i });
    expect(topicTextarea).toBeInTheDocument();

    // Run accessibility check
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
