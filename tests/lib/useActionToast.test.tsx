import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { ToastProvider, useActionToast, type ToastInput } from "~/components/Toast";

type Data = { ok: string | false } | undefined;

const mapper = (d: NonNullable<Data>): ToastInput | null =>
  d.ok ? { variant: "success", message: `ok:${d.ok}` } : null;

/**
 * Drives `useActionToast` the way a route does: `data` is React state, so the
 * buttons simulate a fresh action-result object (a new submit) or a bare
 * re-render (same reference).
 */
function Harness() {
  const [data, setData] = useState<Data>(undefined);
  const [, force] = useState(0);
  useActionToast(data, mapper);
  return (
    <div>
      <button type="button" onClick={() => setData({ ok: "email" })}>
        set-email
      </button>
      <button type="button" onClick={() => setData({ ok: false })}>
        set-fail
      </button>
      <button type="button" onClick={() => force((n) => n + 1)}>
        rerender
      </button>
    </div>
  );
}

function renderWithToasts() {
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

describe("useActionToast", () => {
  it("does not toast for the initial (undefined) data", () => {
    renderWithToasts();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("toasts once when a new action result arrives", async () => {
    const user = userEvent.setup();
    renderWithToasts();
    await user.click(screen.getByRole("button", { name: "set-email" }));
    expect(screen.getByRole("status")).toHaveTextContent("ok:email");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("does not toast when the mapper returns null", async () => {
    const user = userEvent.setup();
    renderWithToasts();
    await user.click(screen.getByRole("button", { name: "set-fail" }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("re-fires for a new result object (per submit, not per render)", async () => {
    const user = userEvent.setup();
    renderWithToasts();
    // Each click builds a fresh { ok: "email" } object → a distinct submit.
    await user.click(screen.getByRole("button", { name: "set-email" }));
    await user.click(screen.getByRole("button", { name: "set-email" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("does not re-fire on a re-render with the same data reference", async () => {
    const user = userEvent.setup();
    renderWithToasts();
    await user.click(screen.getByRole("button", { name: "set-email" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    // A re-render that leaves `data` untouched must not add a toast.
    await user.click(screen.getByRole("button", { name: "rerender" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});
