import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { axe } from "vitest-axe";
import { ToastProvider } from "~/components/Toast";
import { PilotCheckin } from "~/components/pilot/PilotCheckin";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function show() {
  const received: unknown[] = [];
  const action = vi.fn(async ({ request }: { request: Request }) => {
    received.push(await request.json());
    return { ok: true };
  });
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <ToastProvider>
          <PilotCheckin />
        </ToastProvider>
      ),
    },
    { path: "/api/checkin", action },
  ]);
  const view = render(<Stub initialEntries={["/"]} />);
  return { ...view, received };
}

describe("PilotCheckin", () => {
  it("asks three short, optional questions", () => {
    show();
    expect(screen.getByRole("region", { name: /hoe gaat de pilot/i })).toBeTruthy();
    expect(screen.getByLabelText(/wat hielp je/i)).toBeTruthy();
    expect(screen.getByLabelText(/wat ergerde je/i)).toBeTruthy();
    expect(screen.getByLabelText(/wat mis je/i)).toBeTruthy();
  });

  it("sends the answers, thanks with a toast and goes away", async () => {
    const user = userEvent.setup();
    const { received } = show();
    await user.type(screen.getByLabelText(/wat hielp je/i), "De rubric-tool");
    await user.type(screen.getByLabelText(/wat mis je/i), "Voorlezen");
    await user.click(screen.getByRole("button", { name: /versturen/i }));

    await waitFor(() =>
      expect(received).toEqual([
        { intent: "answer", helped: "De rubric-tool", annoyed: "", missing: "Voorlezen" },
      ]),
    );
    expect(await screen.findByText(/bedankt/i)).toBeTruthy();
    expect(screen.queryByRole("region", { name: /hoe gaat de pilot/i })).toBeNull();
  });

  it("sends nothing while every answer is empty", () => {
    show();
    expect(screen.getByRole("button", { name: /versturen/i })).toBeDisabled();
  });

  it("'Niet nu' closes it and remembers the dismissal", async () => {
    const user = userEvent.setup();
    const { received } = show();
    await user.click(screen.getByRole("button", { name: /niet nu/i }));
    expect(screen.queryByRole("region", { name: /hoe gaat de pilot/i })).toBeNull();
    await waitFor(() => expect(received).toEqual([{ intent: "dismiss" }]));
  });

  it("has no a11y violations", async () => {
    const { container } = show();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
