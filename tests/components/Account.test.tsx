import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import Account from "~/routes/account";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderAccount(email: string | null = "teacher@example.com") {
  const props = {
    loaderData: { user: { name: "Teacher T", email, role: "teacher" as const } },
  } as unknown as ComponentProps<typeof Account>;
  const Stub = createRoutesStub([
    { path: "/account", Component: () => <Account {...props} />, action: () => null },
  ]);
  return render(<Stub initialEntries={["/account"]} />);
}

describe("Account page", () => {
  it("offers a change-email form (new email + current password)", () => {
    renderAccount();
    expect(screen.getByLabelText(/nieuw e-mailadres|new email address/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /e-mailadres opslaan|save email/i }),
    ).toBeInTheDocument();
  });

  it("offers a change-password form (current + new + repeat)", () => {
    renderAccount();
    expect(screen.getByLabelText(/^nieuw wachtwoord|^new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/herhaal nieuw|repeat new/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /wachtwoord opslaan|save password/i }),
    ).toBeInTheDocument();
  });

  it("still offers the type-to-confirm account deletion", () => {
    renderAccount();
    expect(
      screen.getByRole("button", { name: /verwijder mijn account|delete my account/i }),
    ).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = renderAccount();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
