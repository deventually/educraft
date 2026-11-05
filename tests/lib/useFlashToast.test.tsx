import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { axe } from "vitest-axe";
import { ToastProvider, useFlashToast } from "~/components/Toast";
import type { Flash } from "~/lib/flash";

/**
 * Drives `useFlashToast` the way the root does: `flash` is the root loader's
 * value, which changes per navigation. The buttons simulate a new flash, the
 * same flash on a re-render, and a navigation without one.
 */
function Harness({ initial }: { initial: Flash | null }) {
  const [flash, setFlash] = useState<Flash | null>(initial);
  const [, force] = useState(0);
  useFlashToast(flash);
  return (
    <div>
      <button type="button" onClick={() => setFlash({ key: "rubricDeleted", id: "b" })}>
        next
      </button>
      <button type="button" onClick={() => setFlash(null)}>
        none
      </button>
      <button type="button" onClick={() => force((n) => n + 1)}>
        rerender
      </button>
    </div>
  );
}

function renderWith(initial: Flash | null) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <ToastProvider>
          <Harness initial={initial} />
        </ToastProvider>
      ),
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("useFlashToast (P16)", () => {
  it("shows the flash from a redirect once, as a success toast", async () => {
    renderWith({ key: "rubricDeleted", id: "a" });
    expect(await screen.findByRole("status")).toHaveTextContent("Rubric verwijderd.");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("shows nothing without a flash", () => {
    renderWith(null);
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("does not repeat the same flash on a re-render", async () => {
    const user = userEvent.setup();
    renderWith({ key: "signedIn", id: "a" });
    await screen.findByRole("status");
    await user.click(screen.getByRole("button", { name: "rerender" }));
    await user.click(screen.getByRole("button", { name: "none" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("shows a new flash, even with the same message", async () => {
    const user = userEvent.setup();
    renderWith({ key: "rubricDeleted", id: "a" });
    await screen.findByRole("status");
    await user.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("has no axe violations", async () => {
    const { container } = renderWith({ key: "welcome", id: "a" });
    await screen.findByRole("status");
    expect((await axe(container)).violations).toEqual([]);
  });
});
