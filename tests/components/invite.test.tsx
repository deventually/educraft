import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import Invite from "~/routes/invite";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderInvite(valid: boolean) {
  // createRoutesStub does not inject loaderData as a prop (framework-mode
  // behaviour), so pass it via a wrapper while still rendering inside the stub's
  // data router (needed for Form/useActionData/useNavigation).
  const props = { loaderData: { valid } } as unknown as ComponentProps<typeof Invite>;
  // No stub loader: loaderData is injected via the wrapper, and omitting the
  // loader keeps the render synchronous (a loader would defer hydration).
  const Stub = createRoutesStub([
    { path: "/invite/:token", Component: () => <Invite {...props} /> },
  ]);
  return render(<Stub initialEntries={["/invite/abc"]} />);
}

describe("Invite page", () => {
  it("renders the account form with labelled fields for a valid invite", () => {
    renderInvite(true);
    expect(screen.getByLabelText(/naam|name/i)).toBeInTheDocument();
    // A repeat-password field distinguishes two password inputs.
    expect(screen.getByLabelText(/^wachtwoord|^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/herhaal|repeat/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /account aanmaken|create account/i }),
    ).toBeInTheDocument();
  });

  it("warns that an email is needed to log back in (email is optional here)", () => {
    renderInvite(true);
    expect(screen.getByText(/zonder e-mailadres|without an email/i)).toBeInTheDocument();
  });

  it("shows a friendly error and no form for an invalid invite", () => {
    renderInvite(false);
    expect(screen.getByRole("heading", { name: /ongeldig|invalid/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/naam|name/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /account aanmaken|create account/i })).toBeNull();
  });

  it("has no a11y violations on the valid form", async () => {
    const { container } = renderInvite(true);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no a11y violations on the invalid state", async () => {
    const { container } = renderInvite(false);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
