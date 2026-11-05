import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { GeneratorView } from "~/components/GeneratorView";
import { getToolBySlug } from "~/lib/registry";
import type { ContextProfile } from "~/lib/context/types";

// happy-dom loads no stylesheet, so axe can't compute real contrast.
const axeOpts = { rules: { "color-contrast": { enabled: false } } };

vi.mock("~/lib/streamClient", () => ({ streamPost: vi.fn() }));

vi.mock("~/lib/i18n/localized", () => ({
  loc: (text: string | Record<string, string> | null | undefined, locale: string) => {
    if (!text) return "";
    if (typeof text === "string") return text;
    return text[locale] || text.en || text.nl || "";
  },
}));

vi.mock("~/lib/i18n/useT", () => ({
  useLocale: () => "en",
  useT: () => ({
    tool: {
      contextProfile: "Context",
      noProfile: "No profile",
      outputLanguage: "Output language",
      dutch: "Dutch",
      english: "English",
      model: "Model",
      advanced: "Advanced",
      generate: "Generate",
      stop: "Stop",
      required: "Required",
      emptyResult: "Nothing yet",
      fileComingSoon: "File upload coming soon",
    },
  }),
}));

const profiles: ContextProfile[] = [
  { id: "p2", name: "SE year 2", studyYear: 2 },
  { id: "p4", name: "Graduation", studyYear: 4 },
  { id: "pNo", name: "No year set" }, // no studyYear → nothing to derive
];

describe("GeneratorView — profile prefill", () => {
  it("derives ARCS course level from the selected profile's study year, and re-derives on switch", async () => {
    const user = userEvent.setup();
    const tool = getToolBySlug("arcs-reactor")!;
    render(<GeneratorView tool={tool} profiles={profiles} defaultProfileId="p2" />);

    // Mounted with the default profile (year 2) → course level prefilled, no re-entry.
    const level = screen.getByLabelText(/course level/i);
    expect(level).toHaveValue("main phase (years 2-3)");

    const profilePicker = screen.getByRole("combobox", { name: "Context" });

    // Switch to a year-4 profile → level re-derives to the graduation phase.
    await user.selectOptions(profilePicker, "p4");
    expect(level).toHaveValue("graduation phase (year 4)");

    // Switch to a profile without a study year → level resets to its empty
    // placeholder state, so a stale prefill never lingers.
    await user.selectOptions(profilePicker, "pNo");
    expect(level).toHaveValue("");
  });

  it("puts the task fields before the context and model controls", () => {
    const tool = getToolBySlug("arcs-reactor")!;
    render(<GeneratorView tool={tool} profiles={profiles} defaultProfileId="p2" />);
    const firstField = screen.getByLabelText(/discipline/i);
    const contextSelect = screen.getByRole("combobox", { name: "Context" });
    expect(
      firstField.compareDocumentPosition(contextSelect) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("has no accessibility violations", async () => {
    const tool = getToolBySlug("arcs-reactor")!;
    const { container } = render(
      <GeneratorView tool={tool} profiles={profiles} defaultProfileId="p2" />,
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("GeneratorView — values handed over by a utility (P24.5)", () => {
  it("fills the tool's own fields once, and ignores names it does not have", async () => {
    const { writeHandoff } = await import("~/lib/forms/handoff");
    const tool = getToolBySlug("rubric-builder")!;
    writeHandoff(tool.slug, { assignment: "Handed over", notAField: "x" });
    const { MemoryRouter } = await import("react-router");
    const view = () => (
      <MemoryRouter>
        <GeneratorView tool={tool} profiles={[]} defaultProfileId="" />
      </MemoryRouter>
    );
    const { unmount } = render(view());
    expect(await screen.findByDisplayValue("Handed over")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("x")).toBeNull();
    unmount();
    // Taken once: a second visit starts empty.
    render(view());
    expect(screen.queryByDisplayValue("Handed over")).toBeNull();
  });
});
