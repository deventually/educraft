import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import ResetPassword from "~/routes/reset.$token";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderReset(valid: boolean) {
  const props = { loaderData: { valid } } as unknown as ComponentProps<typeof ResetPassword>;
  const Stub = createRoutesStub([
    { path: "/reset/:token", Component: () => <ResetPassword {...props} /> },
  ]);
  return render(<Stub initialEntries={["/reset/tok"]} />);
}

describe("Reset password page", () => {
  it("renders a new-password form for a valid token", () => {
    renderReset(true);
    expect(screen.getByLabelText(/^wachtwoord|^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/herhaal|repeat/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /wachtwoord opslaan|save password/i }),
    ).toBeInTheDocument();
  });

  it("shows a friendly error and no form for an invalid/expired token", () => {
    renderReset(false);
    expect(screen.getByRole("heading", { name: /ongeldig|invalid/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^wachtwoord|^password/i)).toBeNull();
  });

  it("has no a11y violations on the valid form", async () => {
    const { container } = renderReset(true);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no a11y violations on the invalid state", async () => {
    const { container } = renderReset(false);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
