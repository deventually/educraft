import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { FeedbackWidget } from "~/components/FeedbackWidget";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderWidget(generationId = "gen-123") {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <FeedbackWidget generationId={generationId} /> },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("FeedbackWidget", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // "Nuttig" / "Niet nuttig" — anchor the positive matcher so it doesn't also
  // match the negative button (which contains the word "nuttig").
  const UP = /^(nuttig|helpful)$/i;
  const DOWN = /niet nuttig|not helpful/i;

  it("renders two thumb buttons exposing aria-pressed state", () => {
    renderWidget();
    expect(screen.getByRole("button", { name: UP })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: DOWN })).toHaveAttribute("aria-pressed", "false");
  });

  it("posts the rating to /api/feedback when a thumb is clicked", async () => {
    const user = userEvent.setup();
    renderWidget("gen-abc");
    await user.click(screen.getByRole("button", { name: UP }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/feedback");
    expect(init.method).toBe("POST");
    const sent = JSON.parse(init.body as string);
    expect(sent.generationId).toBe("gen-abc");
    expect(sent.rating).toBe(1);
  });

  it("marks the chosen thumb as pressed", async () => {
    const user = userEvent.setup();
    renderWidget();
    const up = screen.getByRole("button", { name: UP });
    await user.click(up);
    await waitFor(() => expect(up).toHaveAttribute("aria-pressed", "true"));
  });

  it("has no a11y violations", async () => {
    const { container } = renderWidget();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
