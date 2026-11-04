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
      advanced: "Advanced",
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
// The model picker lives in the closed "Advanced" disclosure; open it first.
async function openAdvanced(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Advanced"));
}

describe("ToolControls", () => {
  it("offers the client-selectable catalog models and hides caller-forbidden ones (Opus)", async () => {
    const user = userEvent.setup();
    renderControls();
    await openAdvanced(user);
    expect(screen.getByRole("option", { name: "Claude Sonnet 4.6" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Claude Haiku 4.5" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Claude Code (CLI)" })).toBeInTheDocument();
    // Opus is not client-selectable → never offered in the picker.
    expect(screen.queryByRole("option", { name: "Claude Opus 4.8" })).toBeNull();
  });

  it("narrows to vision-capable models when the tool requires images", async () => {
    const user = userEvent.setup();
    renderControls({ requiresImages: true });
    await openAdvanced(user);
    // A vision model stays…
    expect(screen.getByRole("option", { name: "Claude Sonnet 4.6" })).toBeInTheDocument();
    // …non-vision CLI models drop out.
    expect(screen.queryByRole("option", { name: "Claude Code (CLI)" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Gemini CLI" })).toBeNull();
  });

  it("renders an admin-configured catalog allow-list verbatim, replacing the default catalog", async () => {
    const user = userEvent.setup();
    const catalogModels: PickerModel[] = [
      { id: "house-fast", displayName: "House Fast", supportsImages: true },
      { id: "house-text", displayName: "House Text", supportsImages: false },
    ];
    renderControls({ catalogModels, model: "house-fast" });
    await openAdvanced(user);
    expect(screen.getByRole("option", { name: "House Fast" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "House Text" })).toBeInTheDocument();
    // The default catalog is replaced, not merged in.
    expect(screen.queryByRole("option", { name: "Claude Sonnet 4.6" })).toBeNull();
  });

  it("reports the chosen model via onModel", async () => {
    const user = userEvent.setup();
    const { onModel } = renderControls();
    await openAdvanced(user);
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

  it("omits the profile picker when the tool does not use a context profile", async () => {
    const user = userEvent.setup();
    renderControls({ usesContextProfile: false });
    await openAdvanced(user);
    // No profile select…
    expect(screen.queryByRole("combobox", { name: "Context" })).toBeNull();
    // …only the language + model selects remain.
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
  });

  it("keeps the model picker inside a closed 'Advanced' section", () => {
    const { container } = renderControls();
    const details = modelSelect().closest("details") as HTMLDetailsElement | null;
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    expect(container.querySelectorAll("details")).toHaveLength(1);
    // The summary names the chosen model so nothing is hidden silently.
    expect(details?.querySelector("summary")).toHaveTextContent("Claude Sonnet 4.6");
  });

  it("keeps the context and language pickers outside 'Advanced'", () => {
    renderControls();
    expect(profileSelect().closest("details")).toBeNull();
    expect(languageSelect().closest("details")).toBeNull();
  });

  it("shows no 'Advanced' when only one model is offered", () => {
    const catalogModels: PickerModel[] = [{ id: "only-one", displayName: "Only One" }];
    const { container } = renderControls({ catalogModels, model: "only-one" });
    expect(container.querySelector("details")).toBeNull();
    expect(screen.queryByText("Advanced")).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Model" })).toBeNull();
  });

  it("disables every control when disabled", async () => {
    const user = userEvent.setup();
    renderControls({ disabled: true });
    await openAdvanced(user);
    for (const select of screen.getAllByRole("combobox")) {
      expect(select).toBeDisabled();
    }
  });

  it("has no a11y violations (every select carries an accessible name)", async () => {
    const { container } = renderControls();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no a11y violations with 'Advanced' open", async () => {
    const user = userEvent.setup();
    const { container } = renderControls();
    await openAdvanced(user);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
