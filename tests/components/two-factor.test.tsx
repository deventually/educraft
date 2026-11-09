import { describe, expect, it } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AccountTwoFactor from "~/routes/account.2fa";
import LoginTwoFactor from "~/routes/login.2fa";
import Account from "~/routes/account";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

type Data = ComponentProps<typeof AccountTwoFactor>["loaderData"];
function renderSetup(data: Partial<Data>, action: () => unknown = () => null) {
  const loaderData = { enabled: false, required: false, recoveryLeft: 0, setup: null, ...data };
  const props = { loaderData } as unknown as ComponentProps<typeof AccountTwoFactor>;
  const Stub = createRoutesStub([
    { path: "/account/2fa", Component: () => <AccountTwoFactor {...props} />, action },
  ]);
  return render(<Stub initialEntries={["/account/2fa"]} />);
}

const SETUP = {
  secret: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
  uri: "otpauth://totp/LimeOnIt:x",
  qr: "data:image/svg+xml;base64,PHN2Zy8+",
};

describe("two-step verification on /account/2fa (P2-12)", () => {
  it("off: a set-up button, no violations", async () => {
    const { container } = renderSetup({});
    expect(screen.getByRole("heading", { level: 1, name: /tweestapsverificatie|two-step/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /instellen|set up/i })).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("an admin without it is told it is required", () => {
    renderSetup({ required: true });
    expect(screen.getByText(/verplicht|required/i)).toBeInTheDocument();
  });

  it("setting up: a QR code with alt text, the key, a labelled code field", async () => {
    const { container } = renderSetup({ setup: SETUP });
    expect(screen.getByRole("img", { name: /qr/i })).toHaveAttribute("src", SETUP.qr);
    expect(screen.getByText(SETUP.secret)).toBeInTheDocument();
    expect(screen.getByLabelText(/code uit je app|code from your app/i)).toHaveAttribute(
      "autocomplete",
      "one-time-code",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("after confirming, the 10 recovery codes are shown once", async () => {
    const user = userEvent.setup();
    const codes = Array.from({ length: 10 }, (_, i) => `aaaa${i}-bbbbb`);
    renderSetup({ setup: SETUP }, () => ({ ok: "enabled", recoveryCodes: codes }));
    await user.type(screen.getByLabelText(/code uit je app|code from your app/i), "123456");
    await user.click(screen.getByRole("button", { name: /bevestigen|confirm/i }));
    expect(await screen.findByText("aaaa9-bbbbb")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /herstelcodes|recovery codes/i })).toBeInTheDocument();
  });

  it("on for a teacher: new codes and turning off; for an admin no turning off", async () => {
    const { container, unmount } = renderSetup({ enabled: true, recoveryLeft: 7 });
    expect(screen.getByText(/7/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /nieuwe herstelcodes|new recovery codes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /zet uit|turn off/i })).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    unmount();
    renderSetup({ enabled: true, required: true });
    expect(screen.queryByRole("button", { name: /^zet uit$|^turn off$/i })).toBeNull();
  });
});

describe("the second login step (P2-12)", () => {
  function renderStep(action?: () => unknown) {
    const Stub = createRoutesStub([{ path: "/login/2fa", Component: LoginTwoFactor, action }]);
    return render(<Stub initialEntries={["/login/2fa"]} />);
  }

  it("asks for a code in a main landmark, with no violations", async () => {
    const { container } = renderStep();
    expect(screen.getByRole("main")).toContainElement(screen.getByLabelText(/herstelcode|recovery code/i));
    expect(screen.getByRole("link", { name: /terug naar inloggen|back to log in/i })).toHaveAttribute("href", "/login");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows a wrong code as an alert", async () => {
    const user = userEvent.setup();
    renderStep(() => ({ error: "Die code klopt niet." }));
    await user.type(screen.getByLabelText(/herstelcode|recovery code/i), "000000");
    await user.click(screen.getByRole("button", { name: /verder|continue/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Die code klopt niet.");
  });
});

describe("the account page links to two-step verification (P2-12)", () => {
  function renderAccount(twoFactor: boolean) {
    const props = {
      loaderData: { user: { name: "T", email: null, role: "teacher" }, isOwner: false, teams: [], twoFactor },
    } as unknown as ComponentProps<typeof Account>;
    const Stub = createRoutesStub([{ path: "/account", Component: () => <Account {...props} /> }]);
    return render(<Stub initialEntries={["/account"]} />);
  }

  it("offers to set it up when off, to manage it when on", () => {
    const { unmount } = renderAccount(false);
    expect(screen.getByRole("link", { name: /tweestapsverificatie instellen|set up two-step/i })).toHaveAttribute("href", "/account/2fa");
    unmount();
    renderAccount(true);
    expect(screen.getByRole("link", { name: /tweestapsverificatie beheren|manage two-step/i })).toBeInTheDocument();
  });
});
