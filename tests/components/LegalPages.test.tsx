import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import Contact from "~/routes/contact";
import Cookies from "~/routes/cookies";
import Legal from "~/routes/legal";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderPage(Component: () => React.JSX.Element) {
  const Stub = createRoutesStub([{ path: "/", Component }]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("footer info pages", () => {
  it("Contact shows the heading and a mailto link", () => {
    renderPage(Contact);
    expect(screen.getByRole("heading", { name: "Contact" })).toBeInTheDocument();
    const mail = screen.getByRole("link", { name: /@/ });
    expect(mail).toHaveAttribute("href", expect.stringMatching(/^mailto:/));
  });

  it("Cookies renders its heading (Dutch default)", () => {
    renderPage(Cookies);
    expect(screen.getByRole("heading", { name: "Privacy & cookies" })).toBeInTheDocument();
  });

  it("Legal renders the disclaimer heading", () => {
    renderPage(Legal);
    expect(screen.getByRole("heading", { name: "Disclaimer" })).toBeInTheDocument();
  });

  it("has no a11y violations on each page", async () => {
    for (const Component of [Contact, Cookies, Legal]) {
      const { container, unmount } = renderPage(Component);
      const results = await axe(container, axeOpts);
      expect(results.violations).toEqual([]);
      unmount();
    }
  });
});
