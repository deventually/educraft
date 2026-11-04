import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import About from "~/routes/about";

function renderAbout() {
  // createRoutesStub does not inject the loaderData prop, so pass it via a
  // wrapper while keeping the stub's router context (useLocale → root loader).

  const Stub = createRoutesStub([{ path: "/", Component: () => <About /> }]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("About / tools catalog", () => {
  it("lists no tools (the start page does)", () => {
    renderAbout();
    expect(screen.queryByText("Beschikbare tools")).toBeNull();
    expect(screen.queryByText("Voor docenten")).toBeNull();
    expect(screen.queryByText("Voor studenten")).toBeNull();
  });

  it("no longer shows phase or coming-soon labels", () => {
    renderAbout();
    expect(screen.queryByText(/MVP/)).toBeNull();
    expect(screen.queryByText("Binnenkort")).toBeNull();
  });

  it("has no a11y violations", async () => {
    const { container } = renderAbout();
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
