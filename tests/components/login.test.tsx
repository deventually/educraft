import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import Login from "~/routes/login";
import { getMessages } from "~/lib/i18n";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderLogin(action?: () => unknown) {
  // No stub loader: Login reads no loader data, and omitting it keeps the render
  // synchronous (a loader would defer hydration and leave an empty body).
  const Stub = createRoutesStub([{ path: "/login", Component: Login, action }]);
  return render(<Stub initialEntries={["/login"]} />);
}

describe("Login page", () => {
  it("renders labelled email and password fields and a submit button", () => {
    renderLogin();
    expect(screen.getByLabelText(/e-mail|email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/wachtwoord|password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /inloggen|log in/i })).toBeInTheDocument();
  });

  it("uses a password input type for the password field", () => {
    renderLogin();
    expect(screen.getByLabelText(/wachtwoord|password/i)).toHaveAttribute("type", "password");
  });

  it("shows a generic error message after a failed submit", async () => {
    const user = userEvent.setup();
    renderLogin(() => ({ error: "Onjuiste e-mail of wachtwoord." }));
    await user.type(screen.getByLabelText(/e-mail|email/i), "x@example.com");
    await user.type(screen.getByLabelText(/wachtwoord|password/i), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /inloggen|log in/i }));
    expect(await screen.findByText(/onjuiste e-mail of wachtwoord/i)).toBeInTheDocument();
  });

  it("shows the deactivated-account message (P18.7) as an alert, with no violations", async () => {
    const user = userEvent.setup();
    const nl = getMessages("nl").auth.accountDisabled;
    const { container } = renderLogin(() => ({ error: nl }));
    await user.type(screen.getByLabelText(/e-mail|email/i), "x@example.com");
    await user.type(screen.getByLabelText(/wachtwoord|password/i), "correct-password");
    await user.click(screen.getByRole("button", { name: /inloggen|log in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/non-actief|deactivated/i);
    expect(screen.getByRole("alert")).toHaveTextContent(nl);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no a11y violations", async () => {
    const { container } = renderLogin();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
