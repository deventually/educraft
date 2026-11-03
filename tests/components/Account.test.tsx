import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import Account from "~/routes/account";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderAccount(
  email: string | null = "teacher@example.com",
  role: "teacher" | "admin" = "teacher",
  isOwner = false,
) {
  const props = {
    loaderData: { user: { name: "Teacher T", email, role }, isOwner },
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

  it("still offers a teacher the type-to-confirm account deletion", () => {
    renderAccount();
    expect(
      screen.getByRole("button", { name: /verwijder mijn account|delete my account/i }),
    ).toBeInTheDocument();
  });

  it("offers the hard delete to everyone, with no request-removal variant", () => {
    renderAccount();
    expect(
      screen.getByRole("button", { name: /verwijder mijn account|delete my account/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /vraag verwijdering|request removal/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the owner a transfer note instead of delete", async () => {
    const { container } = renderAccount("owner@example.com", "admin", true);
    expect(
      screen.queryByRole("button", { name: /verwijder mijn account|delete my account/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/superbeheerder|super admin/i, { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/set-owner/)).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("still shows a regular admin the delete form", () => {
    renderAccount("admin@example.com", "admin", false);
    expect(
      screen.getByRole("button", { name: /verwijder mijn account|delete my account/i }),
    ).toBeInTheDocument();
  });

  it("has no a11y violations (teacher and admin variants)", async () => {
    const teacher = renderAccount();
    expect((await axe(teacher.container, axeOpts)).violations).toEqual([]);
    const admin = renderAccount("admin@example.com", "admin");
    expect((await axe(admin.container, axeOpts)).violations).toEqual([]);
  });
});
