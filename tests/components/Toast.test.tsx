import { describe, it, expect, vi, afterEach } from "vitest";
import { useRef } from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { ToastProvider, useToast } from "~/components/Toast";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

/**
 * A tiny consumer that exposes each toast operation behind a button, so the
 * tests can drive the provider the way real routes do. The pending id is kept
 * in a ref so the "resolve" button can call `updateToast` on the same toast.
 */
function Harness() {
  const { showToast, updateToast } = useToast();
  const pendingId = useRef<number | null>(null);
  return (
    <div>
      <button
        type="button"
        onClick={() => showToast({ variant: "success", message: "Opgeslagen." })}
      >
        success
      </button>
      <button type="button" onClick={() => showToast({ variant: "error", message: "Mislukt." })}>
        error
      </button>
      <button
        type="button"
        onClick={() => {
          pendingId.current = showToast({ variant: "pending", message: "Bezig…" });
        }}
      >
        pending
      </button>
      <button
        type="button"
        onClick={() =>
          pendingId.current != null &&
          updateToast(pendingId.current, { variant: "success", message: "Klaar." })
        }
      >
        resolve
      </button>
      <button
        type="button"
        onClick={() => {
          for (let i = 1; i <= 4; i++) showToast({ variant: "info", message: `Melding ${i}` });
        }}
      >
        burst
      </button>
    </div>
  );
}

function renderHarness() {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <ToastProvider>
          <Harness />
        </ToastProvider>
      ),
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Toast", () => {
  it("renders nothing (no region, no live message) when empty", () => {
    renderHarness();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("shows a polite success toast", async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole("button", { name: "success" }));
    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("Opgeslagen.");
    expect(toast).toHaveAttribute("aria-live", "polite");
  });

  it("shows an assertive error toast that does not auto-dismiss", () => {
    renderHarness();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "error" }));
    const toast = screen.getByRole("alert");
    expect(toast).toHaveTextContent("Mislukt.");
    expect(toast).toHaveAttribute("aria-live", "assertive");
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("auto-dismisses a success toast after 4000ms", () => {
    renderHarness();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "success" }));
    expect(screen.getByRole("status")).toHaveTextContent("Opgeslagen.");
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("dismisses a toast when its close button is pressed", async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole("button", { name: "error" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Melding sluiten" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("pauses auto-dismiss while the region is hovered", () => {
    renderHarness();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "success" }));
    const region = screen.getByRole("list", { name: "Meldingen" });
    fireEvent.mouseEnter(region);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    // Paused → still present.
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.mouseLeave(region);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("updates a pending toast in place into a success (no second toast)", async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole("button", { name: "pending" }));
    expect(screen.getByText("Bezig…")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "resolve" }));
    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("Klaar.");
    expect(screen.queryByText("Bezig…")).toBeNull();
    // Still a single toast — an in-place swap, not a new one.
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("caps the stack at three, dropping the oldest", async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole("button", { name: "burst" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText("Melding 1")).toBeNull();
    expect(screen.getByText("Melding 2")).toBeInTheDocument();
    expect(screen.getByText("Melding 4")).toBeInTheDocument();
  });

  it("uses the localized dismiss label", async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole("button", { name: "success" }));
    expect(screen.getByRole("button", { name: "Melding sluiten" })).toBeInTheDocument();
  });

  it("has no a11y violations with an active success and error toast", async () => {
    const user = userEvent.setup();
    const { container } = renderHarness();
    await user.click(screen.getByRole("button", { name: "success" }));
    await user.click(screen.getByRole("button", { name: "error" }));
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
