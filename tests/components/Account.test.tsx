import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import Account from "~/routes/account";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderAccount(
  email: string | null = "teacher@example.com",
  role: "teacher" | "student" | "admin" = "teacher",
) {
  const props = {
    loaderData: { user: { name: "Teacher T", email, role } },
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

  it("[P14] a student sees the request-removal variant, not a hard delete", () => {
    renderAccount("student@example.com", "student");
    expect(
      screen.getByRole("button", { name: /vraag verwijdering|request removal/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /verwijder mijn account|delete my account/i }),
    ).not.toBeInTheDocument();
  });

  it("has no a11y violations (teacher and student variants)", async () => {
    const teacher = renderAccount();
    expect((await axe(teacher.container, axeOpts)).violations).toEqual([]);
    const student = renderAccount("student@example.com", "student");
    expect((await axe(student.container, axeOpts)).violations).toEqual([]);
  });
});
