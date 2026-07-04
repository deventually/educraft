import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { AiNotice } from "~/components/AiNotice";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderNotice(variant: "generic" | "assistive") {
  // Render inside a data router so useT()/useRouteLoaderData resolve (no root
  // loader → default Dutch locale, so we assert the Dutch copy).
  const Stub = createRoutesStub([{ path: "/", Component: () => <AiNotice variant={variant} /> }]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("AiNotice", () => {
  it("renders the generic AI-draft notice", () => {
    renderNotice("generic");
    expect(screen.getByText(/AI-gegenereerd concept/i)).toBeInTheDocument();
  });

  it("renders the stronger teacher-decides notice for the assistive variant", () => {
    renderNotice("assistive");
    expect(screen.getByText(/de docent beslist/i)).toBeInTheDocument();
  });

  it("defaults to the generic variant", () => {
    const Stub = createRoutesStub([{ path: "/", Component: () => <AiNotice /> }]);
    render(<Stub initialEntries={["/"]} />);
    expect(screen.getByText(/AI-gegenereerd concept/i)).toBeInTheDocument();
  });

  it("has no a11y violations (generic)", async () => {
    const { container } = renderNotice("generic");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no a11y violations (assistive)", async () => {
    const { container } = renderNotice("assistive");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
