import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
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

  it("after a thumb, asks how much time it saved and how good it was", async () => {
    const user = userEvent.setup();
    renderWidget();
    await user.click(screen.getByRole("button", { name: UP }));
    const time = screen.getByRole("group", { name: /hoeveel tijd scheelde dit/i });
    expect(
      within(time)
        .getAllByRole("radio")
        .map((r) => (r as HTMLInputElement).value),
    ).toEqual(["0", "15", "30", "60"]);
    expect(within(time).getByRole("radio", { name: /60\+ min/ })).toBeTruthy();
    const quality = screen.getByRole("group", { name: /kwaliteit/i });
    expect(within(quality).getAllByRole("radio")).toHaveLength(5);
  });

  it("sends the time saved, the quality and the comment with the rating", async () => {
    const user = userEvent.setup();
    renderWidget("gen-t");
    await user.click(screen.getByRole("button", { name: DOWN }));
    await user.click(screen.getByRole("radio", { name: /30 min/ }));
    await user.click(screen.getByRole("radio", { name: "4" }));
    await user.type(screen.getByRole("textbox"), "Te lang");
    await user.click(screen.getByRole("button", { name: /versturen|send/i }));

    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const last = JSON.parse(calls[calls.length - 1]![1].body as string);
    expect(last).toEqual({
      generationId: "gen-t",
      rating: -1,
      comment: "Te lang",
      minutesSaved: 30,
      quality: 4,
    });
    expect(await screen.findByText(/bedankt/i)).toBeTruthy();
  });

  it("has no a11y violations with the questions open", async () => {
    const user = userEvent.setup();
    const { container } = renderWidget();
    await user.click(screen.getByRole("button", { name: UP }));
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no a11y violations", async () => {
    const { container } = renderWidget();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
