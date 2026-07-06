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
  updateProfile: () => {},
  deleteProfile: () => {},
  getDefaultProfile: () => null,
}));
vi.mock("~/server/availability.server", () => ({
  getAvailableCountries: async () => ["NL"],
  getAvailableSectors: async () => ["vo", "mbo", "hbo", "wo"],
}));

import Settings from "~/routes/context-profiles";

type Profile = {
  id: string;
  name: string;
  sector?: string;
  domain?: string;
  eqf?: number;
  nationalLevel?: string;
  packValues?: Record<string, unknown>;
  customFields?: { label: string; value: string }[];
};

function renderSettings(profiles: Profile[] = [], defaultId = "") {
  const props = {
    loaderData: {
      profiles,
      defaultId,
      availableCountries: ["NL"],
      availableSectors: ["vo", "mbo", "hbo", "wo"],
    },
  } as unknown as ComponentProps<typeof Settings>;
  const Stub = createRoutesStub([
    { path: "/context-profiles", Component: () => <Settings {...props} /> },
  ]);
  return render(<Stub initialEntries={["/context-profiles"]} />);
}

// happy-dom loads no stylesheet, so axe can't compute real contrast.
const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const ictProfile: Profile = {
  id: "p1",
  name: "SE jaar 3",
  sector: "hbo",
  domain: "ICT",
  nationalLevel: "6",
  packValues: { architectuurlagen: ["Software"], beheersingsniveau: 2 },
  customFields: [{ label: "Specialisatie", value: "Security" }],
};

describe("Context settings", () => {
  it("has no wizard-vs-form choice screen (consolidated into one editor)", () => {
    renderSettings();
    expect(screen.queryByRole("button", { name: /wizard/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /zelf invullen|yourself/i })).toBeNull();
  });

  it("shows an empty-state hint when there is no profile yet", () => {
    renderSettings([]);
    expect(screen.getByText(/nog geen contextprofiel|no context profile/i)).toBeInTheDocument();
  });

  it("opens the editor directly at step 1 when creating a new profile", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("button", { name: /nieuw|new/i }));
    expect(screen.getByText(/stap 1 van 4|step 1 of 4/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/naam|name/i)).toBeInTheDocument();
  });

  it("shows a sector badge on a profile card", () => {
    renderSettings([ictProfile], "p1");
    // The list card carries the sector (hbo) as a badge.
    expect(screen.getByText(/hbo/i)).toBeInTheDocument();
  });

  it("edits a profile, opening the editor pre-filled with its values", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings([ictProfile], "p1");
    expect(screen.getByText(/standaard|default/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /bewerken|edit/i }));
    // The stepped editor opens at step 1, prefilled and in edit (update) mode.
    expect(screen.getByText(/stap 1 van 4|step 1 of 4/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("SE jaar 3")).toBeInTheDocument();
    expect(container.querySelector('input[name="id"]')).toHaveValue("p1");
  });

  it("has no a11y violations on the list view", async () => {
    const { container } = renderSettings([ictProfile], "p1");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no a11y violations in the editor", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();
    await user.click(screen.getByRole("button", { name: /nieuw|new/i }));
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
