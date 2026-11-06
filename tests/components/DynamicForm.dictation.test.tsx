import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DynamicForm } from "~/components/DynamicForm";
import type { InputField } from "~/lib/registry/types";

vi.mock("~/lib/i18n/useT", () => ({
  useLocale: () => "en",
  useT: () => ({ tool: {} }),
}));

// The button itself is tested in DictateButton.test.tsx; here only the wiring.
vi.mock("~/components/DictateButton", () => ({
  DictateButton: ({
    field,
    lang,
    onText,
  }: {
    field: string;
    lang: string;
    onText: (t: string) => void;
  }) => (
    <button type="button" onClick={() => onText("dictated words")}>
      {`mic ${field} ${lang}`}
    </button>
  ),
}));

const fields: InputField[] = [
  { name: "name", label: { nl: "Naam", en: "Name" }, kind: "text", required: true },
  {
    name: "goal",
    label: { nl: "Leerdoel", en: "Learning goal" },
    kind: "textarea",
    required: true,
  },
];

describe("DynamicForm — dictation", () => {
  it("offers dictation on every textarea, in the UI language", () => {
    render(<DynamicForm fields={fields} values={{ name: "", goal: "" }} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "mic Learning goal en" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mic Name/ })).toBeNull();
  });

  it("adds the dictated text to what the field already holds", async () => {
    const onChange = vi.fn();
    render(
      <DynamicForm
        fields={fields}
        values={{ name: "", goal: "Students can" }}
        onChange={onChange}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /mic Learning goal/ }));
    expect(onChange).toHaveBeenCalledWith("goal", "Students can dictated words");
  });
});
