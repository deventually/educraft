import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import {
  DynamicForm,
  defaultValuesFor,
  missingRequired,
  profilePrefillValues,
} from "~/components/DynamicForm";
import type { InputField } from "~/lib/registry/types";
import type { ContextProfile } from "~/lib/context/types";

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

  it("seeds a select to its first option so the stored value matches what is shown", () => {
    // A controlled <select> whose value matches no <option> visually shows the
    // first option but holds "". Defaulting to the first option keeps the value
    // and the display in sync, so the choice actually reaches the prompt.
    const fields: InputField[] = [
      {
        name: "theorist",
        label: { nl: "Theoreticus", en: "Theorist" },
        kind: "select",
        required: true,
        options: [
          { value: "Jean Piaget", label: { nl: "Piaget", en: "Piaget" } },
          { value: "Lev Vygotsky", label: { nl: "Vygotsky", en: "Vygotsky" } },
        ],
      },
    ];

    const values = defaultValuesFor(fields);
    expect(values.theorist).toBe("Jean Piaget");
  });

  it("seeds a placeholder select to empty so it forces a conscious choice", () => {
    // A select with a placeholder + no default starts unselected (""), rendering
    // a leading empty option. This makes "no choice" a real, visible state so a
    // required select can't silently submit its first option.
    const fields: InputField[] = [
      {
        name: "level",
        label: { nl: "Niveau", en: "Level" },
        kind: "select",
        required: true,
        placeholder: { nl: "Kies een niveau…", en: "Choose a level…" },
        options: [
          { value: "year1", label: { nl: "Jaar 1", en: "Year 1" } },
          { value: "year2", label: { nl: "Jaar 2", en: "Year 2" } },
        ],
      },
    ];

    const values = defaultValuesFor(fields);
    expect(values.level).toBe(""); // not the first option
    // …and a required placeholder select reads as missing until a choice is made.
    expect(missingRequired(fields, values).map((f) => f.name)).toContain("level");

    render(<DynamicForm fields={fields} values={values} onChange={() => {}} />);
    const select = screen.getByRole("combobox", { name: /Level/i });
    expect(select).toHaveValue("");
    expect(screen.getByRole("option", { name: "Choose a level…" })).toBeInTheDocument();
  });

  it("derives field values from the selected profile (mapped + direct), omitting unknowns", () => {
    const fields: InputField[] = [
      {
        name: "level",
        label: { nl: "Niveau", en: "Level" },
        kind: "select",
        prefillFromProfile: { source: "studyYear", map: { "2": "mid", "3": "mid", "4": "grad" } },
        options: [
          { value: "mid", label: { nl: "Midden", en: "Mid" } },
          { value: "grad", label: { nl: "Afstuderen", en: "Graduation" } },
        ],
      },
      {
        name: "discipline",
        label: { nl: "Vak", en: "Subject" },
        kind: "text",
        prefillFromProfile: { source: "programme" }, // no map → copy through
      },
      {
        name: "year",
        label: { nl: "Jaar", en: "Year" },
        kind: "number",
        prefillFromProfile: { source: "studyYear" }, // no map → keep the numeric type
      },
      { name: "free", label: { nl: "Vrij", en: "Free" }, kind: "text" },
    ];
    const profile = { id: "x", name: "X", studyYear: 3, programme: "HBO-ICT" } as ContextProfile;

    expect(profilePrefillValues(fields, profile)).toEqual({
      level: "mid",
      discipline: "HBO-ICT",
      year: 3, // number preserved, not "3"
    });
    // A source the profile doesn't set is skipped; no profile yields nothing.
    expect(profilePrefillValues(fields, { id: "y", name: "Y" } as ContextProfile)).toEqual({});
    expect(profilePrefillValues(fields, null)).toEqual({});
  });

  it("honours an explicit select defaultValue over the first option", () => {
    const fields: InputField[] = [
      {
        name: "level",
        label: { nl: "Niveau", en: "Level" },
        kind: "select",
        defaultValue: "hbo",
        options: [
          { value: "mbo", label: { nl: "mbo", en: "mbo" } },
          { value: "hbo", label: { nl: "hbo", en: "hbo" } },
        ],
      },
    ];

    expect(defaultValuesFor(fields).level).toBe("hbo");
  });
});
