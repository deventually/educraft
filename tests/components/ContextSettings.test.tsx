import { describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";

// Avoid loading the SQLite-backed repository (and better-sqlite3) in jsdom.
vi.mock("~/server/repositories/profiles.server", () => ({
  listProfiles: () => [],
  createProfile: () => ({}),
  deleteProfile: () => {},
}));

import Settings from "~/routes/settings";

type Profile = {
  id: string;
  name: string;
  domain?: string;
  eqf?: number;
  packValues?: Record<string, unknown>;
  customFields?: { label: string; value: string }[];
};

function renderSettings(profiles: Profile[] = [], defaultId = "") {
  const props = { loaderData: { profiles, defaultId } } as unknown as ComponentProps<
    typeof Settings
  >;
  const Stub = createRoutesStub([{ path: "/settings", Component: () => <Settings {...props} /> }]);
  return render(<Stub initialEntries={["/settings"]} />);
}

// happy-dom loads no stylesheet, so axe can't compute real contrast.
const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const ictProfile: Profile = {
  id: "p1",
  name: "SE jaar 3",
  domain: "ICT",
  eqf: 6,
  packValues: { architectuurlagen: ["Software", "Infrastructuur"], beheersingsniveau: 2 },
  customFields: [{ label: "Specialisatie", value: "Security" }],
};

describe("Context settings", () => {
  it("offers a wizard OR a fill-it-yourself choice", () => {
    renderSettings();
    expect(screen.getByRole("button", { name: /wizard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /zelf invullen|yourself/i })).toBeInTheDocument();
  });

  it("shows an empty-state hint when there is no profile yet (no default)", () => {
    renderSettings([]);
    expect(screen.getByText(/nog geen contextprofiel|no context profile/i)).toBeInTheDocument();
  });

  it("launches the wizard at step 1 of 4 with a name field", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("button", { name: /wizard/i }));
    expect(screen.getByText(/stap 1 van 4|step 1 of 4/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/naam|name/i)).toBeInTheDocument();
  });

  it("reveals the verified domain pack when a packed domain is chosen in the form", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("button", { name: /zelf invullen|yourself/i }));
    await user.selectOptions(screen.getByLabelText(/domein|domain/i), "ICT");
    // hbo-i architecture layers appear, with the source citation.
    expect(screen.getByText("Architectuurlagen")).toBeInTheDocument();
    expect(screen.getByText(/hbo-i domeinbeschrijving/i)).toBeInTheDocument();
  });

  it("leaves the framework multiselects empty on domain choice, and fills the level once a year is set", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("button", { name: /zelf invullen|yourself/i }));
    await user.selectOptions(screen.getByLabelText(/domein|domain/i), "ICT");

    // Multiselects start empty — the user ticks only what the course emphasises,
    // rather than injecting the whole undifferentiated taxonomy into prompts.
    expect(screen.getByRole("checkbox", { name: "Gebruikersinteractie" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Software" })).not.toBeChecked();
    // EQF defaults to the hbo-bachelor qualification level.
    expect(screen.getByLabelText(/eqf/i)).toHaveValue("6");

    // No level until a study year is chosen; then it fills to the year's default.
    const level = () =>
      screen.getByRole("combobox", { name: /beheersingsniveau|proficiency level/i });
    expect(level()).toHaveValue("");
    await user.selectOptions(screen.getByLabelText(/studiejaar|study year/i), "4");
    expect(level()).toHaveValue("3"); // graduation ceiling
  });

  it("shows an honest 'no national framework' note for an unpacked domain", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("button", { name: /zelf invullen|yourself/i }));
    await user.selectOptions(screen.getByLabelText(/domein|domain/i), "Overig");
    expect(screen.getByText(/geen landelijk raamwerk|no national framework/i)).toBeInTheDocument();
  });

  it("has no a11y violations on the choice screen", async () => {
    const { container } = renderSettings();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no a11y violations in the wizard", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();
    await user.click(screen.getByRole("button", { name: /wizard/i }));
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no a11y violations in the form with a domain pack rendered", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();
    await user.click(screen.getByRole("button", { name: /zelf invullen|yourself/i }));
    await user.selectOptions(screen.getByLabelText(/domein|domain/i), "Zorg & welzijn");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("lets you edit a profile, pre-filling the form with its values", async () => {
    const user = userEvent.setup();
    renderSettings([ictProfile], "p1");
    // The default profile is flagged in the list.
    expect(screen.getByText(/standaard|default/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /bewerken|edit/i }));

    // Generic fields pre-filled.
    expect(screen.getByDisplayValue("SE jaar 3")).toBeInTheDocument();
    expect(screen.getByLabelText(/domein|domain/i)).toHaveValue("ICT");
    // Pack selections pre-checked, and a custom field carried over.
    expect(screen.getByRole("checkbox", { name: "Software" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Gebruikersinteractie" })).not.toBeChecked();
    expect(screen.getByDisplayValue("Specialisatie")).toBeInTheDocument();
    // Save control present (submits as an update).
    expect(screen.getByRole("button", { name: /opslaan|save/i })).toBeInTheDocument();
  });

  it("has no a11y violations while editing", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings([ictProfile], "p1");
    await user.click(screen.getByRole("button", { name: /bewerken|edit/i }));
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
