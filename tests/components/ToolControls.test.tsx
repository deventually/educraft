import { describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

// ToolControls only reads useT(); mock it (the GeneratorView pattern) and use the
// REAL model catalog (pickableModels) so the picker's behaviour is exercised.
// The tool.* strings double as the selects' accessible names (each Label is now
// associated to its Select via htmlFor/id).
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
    },
  }),
}));

import { ToolControls, type PickerModel } from "~/components/ToolControls";
import type { ContextProfile } from "~/lib/context/types";

// happy-dom loads no stylesheet, so axe can't compute real contrast.
const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const profiles: ContextProfile[] = [{ id: "p1", name: "SE year 3" }];

function renderControls(overrides: Partial<ComponentProps<typeof ToolControls>> = {}) {
  const onProfile = vi.fn();
  const onLanguage = vi.fn();
  const onModel = vi.fn();
  const utils = render(
    <ToolControls
      usesContextProfile
      profiles={profiles}
      contextProfileId=""
      onProfile={onProfile}
      outputLanguage="nl"
      onLanguage={onLanguage}
      model="claude-sonnet-4-6"
      onModel={onModel}
      {...overrides}
    />,
  );
  return { ...utils, onProfile, onLanguage, onModel };
}

// Each select carries its label as an accessible name, so we can address them by role.
const modelSelect = () => screen.getByRole("combobox", { name: "Model" });
const languageSelect = () => screen.getByRole("combobox", { name: /output language/i });
const profileSelect = () => screen.getByRole("combobox", { name: "Context" });

describe("ToolControls", () => {
  it("offers the client-selectable catalog models and hides caller-forbidden ones (Opus)", () => {
    renderControls();
    expect(screen.getByRole("option", { name: "Claude Sonnet 4.6" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Claude Haiku 4.5" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Claude Code (CLI)" })).toBeInTheDocument();
    // Opus is not client-selectable → never offered in the picker.
    expect(screen.queryByRole("option", { name: "Claude Opus 4.8" })).toBeNull();
  });

  it("narrows to vision-capable models when the tool requires images", () => {
    renderControls({ requiresImages: true });
    // A vision model stays…
    expect(screen.getByRole("option", { name: "Claude Sonnet 4.6" })).toBeInTheDocument();
    // …non-vision CLI models drop out.
    expect(screen.queryByRole("option", { name: "Claude Code (CLI)" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Gemini CLI" })).toBeNull();
  });

  it("renders an admin-configured catalog allow-list verbatim, replacing the default catalog", () => {
    const catalogModels: PickerModel[] = [
      { id: "house-fast", displayName: "House Fast", supportsImages: true },
      { id: "house-text", displayName: "House Text", supportsImages: false },
    ];
    renderControls({ catalogModels, model: "house-fast" });
    expect(screen.getByRole("option", { name: "House Fast" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "House Text" })).toBeInTheDocument();
    // The default catalog is replaced, not merged in.
    expect(screen.queryByRole("option", { name: "Claude Sonnet 4.6" })).toBeNull();
  });

  it("reports the chosen model via onModel", async () => {
    const user = userEvent.setup();
    const { onModel } = renderControls();
    await user.selectOptions(modelSelect(), "claude-haiku-4-5");
    expect(onModel).toHaveBeenCalledWith("claude-haiku-4-5");
  });

  it("reports a language switch via onLanguage", async () => {
    const user = userEvent.setup();
    const { onLanguage } = renderControls();
    await user.selectOptions(languageSelect(), "en");
    expect(onLanguage).toHaveBeenCalledWith("en");
  });

  it("shows the profile picker only when the tool uses a context profile, and reports the choice", async () => {
    const user = userEvent.setup();
    const { onProfile } = renderControls();
    await user.selectOptions(profileSelect(), "p1");
    expect(onProfile).toHaveBeenCalledWith("p1");
  });

  it("omits the profile picker when the tool does not use a context profile", () => {
    renderControls({ usesContextProfile: false });
    // No profile select…
    expect(screen.queryByRole("combobox", { name: "Context" })).toBeNull();
    // …only the language + model selects remain.
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
  });

  it("disables every control when disabled", () => {
    renderControls({ disabled: true });
    for (const select of screen.getAllByRole("combobox")) {
      expect(select).toBeDisabled();
    }
  });

  it("has no a11y violations (every select carries an accessible name)", async () => {
    const { container } = renderControls();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
