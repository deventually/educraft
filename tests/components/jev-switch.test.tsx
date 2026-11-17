import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { JevSwitch, type JevSwitchState } from "~/components/admin/JevSwitch";
import { ToastProvider } from "~/components/Toast";

// Jev's one switch (BESLUIT-2026-11-17-1): what goes where, that switching on is consent, and
// who last switched it and when.
const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function show(state: JevSwitchState) {
  const Stub = createRoutesStub([
    {
      path: "/admin/tools",
      Component: () => (
        <ToastProvider>
          <JevSwitch state={state} />
        </ToastProvider>
      ),
      action: () => ({ saved: true }),
    },
  ]);
  return render(<Stub initialEntries={["/admin/tools"]} />);
}

describe("JevSwitch", () => {
  it("says what goes to whom, and that switching on is the institution's consent", () => {
    show({ on: false, keySet: true });
    expect(
      screen.getByText(/bestandsnaam en het begin van elk bestand naar OpenRouter/),
    ).toBeInTheDocument();
    const box = screen.getByRole("checkbox", { name: /jev gebruiken/i });
    expect(box).not.toBeChecked();
    expect(box).toHaveAccessibleDescription(/akkoord/i);
    expect(screen.getByText("Nog nooit aangezet.")).toBeInTheDocument();
  });

  it("names who switched it on and when", () => {
    show({ on: true, keySet: true, byName: "Anna Beheer", at: "2026-11-17T08:30:00.000Z" });
    expect(screen.getByRole("checkbox", { name: /jev gebruiken/i })).toBeChecked();
    expect(screen.getByText(/aangezet door anna beheer op 17-11-2026/i)).toBeInTheDocument();
  });

  it("names who switched it off; a removed account is 'een beheerder'", () => {
    show({ on: false, keySet: true, at: "2026-11-17T08:30:00.000Z" });
    expect(screen.getByText(/uitgezet door een beheerder op/i)).toBeInTheDocument();
  });

  it("warns when Jev's own key is missing: then nothing goes to Jev, even when on", () => {
    show({ on: true, keySet: false });
    expect(screen.getByText(/JEV_API_KEY/)).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = show({
      on: true,
      keySet: false,
      byName: "A",
      at: "2026-11-17T08:30:00Z",
    });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
