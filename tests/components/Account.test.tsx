import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "~/components/Toast";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import Account from "~/routes/account";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderAccount(
  email: string | null = "teacher@example.com",
  role: "teacher" | "admin" = "teacher",
  isOwner = false,
  teams: { id: string; name: string; isLead: boolean }[] = [],
  lostCourses = 0,
  action: (args: { request: Request }) => unknown = () => null,
) {
  const props = {
    loaderData: {
      user: { name: "Teacher T", email, role },
      isOwner,
      teams,
      lostCourses,
      defaultModel: {
        current: null,
        options: [
          { id: "claude-haiku-5-5", displayName: "Claude Haiku 5.5" },
          { id: "minimax-m3", displayName: "MiniMax M3" },
        ],
      },
    },
  } as unknown as ComponentProps<typeof Account>;
  const Stub = createRoutesStub([
    {
      path: "/account",
      Component: () => (
        <ToastProvider>
          <Account {...props} />
        </ToastProvider>
      ),
      action,
    },
  ]);
  return render(<Stub initialEntries={["/account"]} />);
}

describe("Account page", () => {
  it("lets me choose my own default model from the models I may use, and autosaves it", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderAccount("teacher@example.com", "teacher", false, [], 0, async ({ request }) => {
      body = await request.formData();
      return { saved: true };
    });
    const select = screen.getByRole("combobox", { name: /mijn standaardmodel/i });
    expect(select).toHaveValue("");
    await user.selectOptions(select, "minimax-m3");
    await waitFor(() => expect(body?.get("intent")).toBe("defaultModel"));
    expect(body?.get("defaultModel")).toBe("minimax-m3");
  });

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

  it("offers 'log out everywhere' and says a session ends after 8 hours of inactivity", async () => {
    const { container } = renderAccount();
    expect(
      screen.getByRole("button", { name: /overal uitloggen|log out everywhere/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/8 uur|8 hours/i)).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("warns before deleting about courses without a co-owner (BESLUIT-2026-11-10-5)", () => {
    renderAccount("teacher@example.com", "teacher", false, [], 2);
    expect(screen.getByText(/Cursussen zonder mede-eigenaar: 2\./)).toBeInTheDocument();
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

describe("Account page — my teams (P28.2)", () => {
  it("lists my teams, each opening the team page (BESLUIT-2026-11-16-7)", async () => {
    const { container } = renderAccount("t@example.com", "teacher", false, [
      { id: "team-1", name: "Verpleegkunde", isLead: true },
      { id: "team-2", name: "Techniek", isLead: false },
    ]);
    expect(screen.getByRole("heading", { name: /mijn teams|my teams/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /verpleegkunde/i })).toHaveAttribute(
      "href",
      "/teams/team-1",
    );
    expect(screen.getByRole("link", { name: /techniek/i })).toHaveAttribute(
      "href",
      "/teams/team-2",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows no teams section without teams", () => {
    renderAccount();
    expect(screen.queryByRole("heading", { name: /mijn teams|my teams/i })).toBeNull();
  });
});

describe("Account page help", () => {
  it("links to the help on your account", () => {
    renderAccount();
    expect(screen.getByRole("link", { name: "Hoe werkt dit?" })).toHaveAttribute(
      "href",
      "/help/account",
    );
  });
});
