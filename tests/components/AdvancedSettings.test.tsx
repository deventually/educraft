import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

vi.mock("~/lib/i18n/useT", async () => {
  const { getMessages } = await import("~/lib/i18n");
  return { useLocale: () => "nl", useT: () => getMessages("nl") };
});

import { AdvancedSettings } from "~/components/AdvancedSettings";

// happy-dom loads no stylesheet, so axe can't compute real contrast.
const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderIt() {
  return render(
    <AdvancedSettings current="Claude Sonnet 5.5">
      <label htmlFor="m">Model</label>
      <select id="m">
        <option>Claude Sonnet 5.5</option>
      </select>
    </AdvancedSettings>,
  );
}

describe("AdvancedSettings", () => {
  it("is closed by default and names the current choice in its summary", () => {
    const { container } = renderIt();
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details).toBeInTheDocument();
    expect(details.open).toBe(false);
    const summary = container.querySelector("summary") as HTMLElement;
    expect(summary).toHaveTextContent("Geavanceerd");
    expect(summary).toHaveTextContent("Claude Sonnet 5.5");
  });

  it("reveals its content when the summary is clicked", async () => {
    const user = userEvent.setup();
    const { container } = renderIt();
    const details = container.querySelector("details") as HTMLDetailsElement;
    await user.click(screen.getByText("Geavanceerd"));
    expect(details.open).toBe(true);
    expect(screen.getByRole("combobox", { name: "Model" })).toBeInTheDocument();
  });

  it("has no a11y violations closed or open", async () => {
    const user = userEvent.setup();
    const { container } = renderIt();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    await user.click(screen.getByText("Geavanceerd"));
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
