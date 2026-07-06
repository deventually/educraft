import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { ContextForm } from "~/components/context/ContextForm";
import type { ContextProfile } from "~/lib/context/types";

// happy-dom loads no stylesheet, so axe can't compute real contrast. There is no
// root loader, so the real i18n resolves to Dutch (DEFAULT_LOCALE) — assert
// Dutch, or use case-insensitive /nl|en/ regexes.
const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderForm(props: Partial<ComponentProps<typeof ContextForm>> = {}) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <ContextForm onCancel={() => {}} {...props} /> },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

const ictProfile = {
  id: "p1",
  name: "SE jaar 3",
  domain: "ICT",
  eqf: 6,
  packValues: {},
} as unknown as ContextProfile;

describe("ContextForm", () => {
  it("reveals the verified domain pack when a packed domain is chosen", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.selectOptions(screen.getByLabelText(/domein|domain/i), "ICT");
    // hbo-i architecture layers appear, with the source citation.
    expect(screen.getByText("Architectuurlagen")).toBeInTheDocument();
    expect(screen.getByText(/hbo-i domeinbeschrijving/i)).toBeInTheDocument();
  });

  it("keeps the save button disabled until the profile has a name", async () => {
    const user = userEvent.setup();
    renderForm();
    const save = screen.getByRole("button", { name: /opslaan|save/i });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText(/naam|name/i), "SE jaar 3");
    expect(save).toBeEnabled();
  });

  it("offers the full EQF 1–8 ladder with EQF 6 as the default", () => {
    renderForm();
    const eqf = screen.getByLabelText(/eqf/i) as HTMLSelectElement;
    const values = Array.from(eqf.querySelectorAll("option")).map((o) => o.value);
    expect(values).toEqual(["", "1", "2", "3", "4", "5", "6", "7", "8"]);
    expect(eqf).toHaveValue("6");
  });

  it("edits an existing profile: prefilled name + a hidden id for the update", () => {
    const { container } = renderForm({ profile: ictProfile });
    expect(screen.getByDisplayValue("SE jaar 3")).toBeInTheDocument();
    const hidden = container.querySelector('input[type="hidden"][name="id"]') as HTMLInputElement;
    expect(hidden).not.toBeNull();
    expect(hidden.value).toBe("p1");
    // In edit mode the save button starts enabled (the name is already set).
    expect(screen.getByRole("button", { name: /opslaan|save/i })).toBeEnabled();
  });

  it("has no a11y violations (blank create form)", async () => {
    const { container } = renderForm();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no a11y violations with a domain pack rendered", async () => {
    const user = userEvent.setup();
    const { container } = renderForm();
    await user.selectOptions(screen.getByLabelText(/domein|domain/i), "ICT");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
