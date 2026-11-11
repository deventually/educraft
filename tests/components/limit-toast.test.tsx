import { beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { axe } from "vitest-axe";
import { ToastProvider } from "~/components/Toast";
import { LimitToast } from "~/components/usage/LimitToast";
import { AI_DONE_EVENT } from "~/lib/usage/limits";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

let limit: unknown = null;

function renderToast() {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <ToastProvider>
          <LimitToast />
        </ToastProvider>
      ),
    },
    { path: "/api/ai-limit", loader: () => ({ limit }) },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("LimitToast", () => {
  beforeEach(() => {
    localStorage.clear();
    limit = null;
  });

  it("tells a teacher once, as a toast, that 80% of the month is used", async () => {
    limit = { scope: "team", teamName: "Informatica", share: 0.85, state: "warn" };
    const { container, unmount } = renderToast();
    const warning = await screen.findByText(
      /Je hebt 85% van je AI-ruimte voor deze maand gebruikt/,
    );
    expect(warning.closest("[role=status]")?.className).toMatch(/amber/);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    unmount();

    // The next page load in the same month says nothing again.
    renderToast();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.queryByText(/85%/)).toBeNull();
  });

  it("checks again when an AI call ends, and says when the month is spent", async () => {
    limit = { scope: "user", share: 0.5, state: "ok" };
    renderToast();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.queryByRole("status")).toBeNull();

    limit = { scope: "user", share: 1, state: "stop" };
    await act(async () => {
      window.dispatchEvent(new Event(AI_DONE_EVENT));
    });
    expect(
      await screen.findByText(/Je AI-ruimte voor deze maand is op \(je eigen limiet\)/),
    ).toBeInTheDocument();
  });

  it("says nothing without a limit", async () => {
    renderToast();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.queryByText(/AI-ruimte/)).toBeNull();
  });
});
