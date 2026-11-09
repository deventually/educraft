import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { ErrorReportHint } from "~/components/ErrorReportHint";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderHint(now = new Date(2026, 10, 9, 19, 2, 11)) {
  const Stub = createRoutesStub([
    {
      path: "/portfolio/:id",
      Component: () => (
        <main>
          <h1>Oeps!</h1>
          <ErrorReportHint now={now} />
        </main>
      ),
    },
  ]);
  return render(<Stub initialEntries={["/portfolio/7?tab=lu1"]} />);
}

describe("ErrorReportHint (what a teacher reports, P1)", () => {
  it("tells the teacher to pass on the exact time and the page", async () => {
    renderHint();
    expect(await screen.findByText(/Meld dit aan je beheerder/)).toBeInTheDocument();
    // Time to the second, so the owner finds it on "Recente fouten".
    expect(await screen.findByText(/19:02:11/)).toBeInTheDocument();
    // The page without its query string, as the error log stores it.
    expect(screen.getByText("/portfolio/7")).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = renderHint();
    await screen.findByText(/19:02:11/);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
