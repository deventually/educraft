import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { SessionHelpfulness } from "~/components/SessionHelpfulness";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderControl(onSubmit = vi.fn()) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <SessionHelpfulness onSubmit={onSubmit} /> },
  ]);
  const utils = render(<Stub initialEntries={["/"]} />);
  return { onSubmit, ...utils };
}

// "Nuttig" also occurs inside "Niet nuttig" — anchor the positive matcher.
const HELPFUL = /^nuttig$/i;
const NOT_HELPFUL = /niet nuttig/i;

describe("SessionHelpfulness", () => {
  it("offers a labelled group of three self-report options", () => {
    renderControl();
    expect(screen.getByRole("group", { name: /was dit nuttig/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: HELPFUL })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: NOT_HELPFUL })).toBeInTheDocument();
  });

  it("reports +1 when the student picks 'helpful' and thanks them", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderControl();
    await user.click(screen.getByRole("button", { name: HELPFUL }));
    expect(onSubmit).toHaveBeenCalledWith(1);
    await waitFor(() => expect(screen.getByText(/bedankt/i)).toBeInTheDocument());
  });

  it("reports -1 when the student picks 'not helpful'", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderControl();
    await user.click(screen.getByRole("button", { name: NOT_HELPFUL }));
    expect(onSubmit).toHaveBeenCalledWith(-1);
  });

  it("explains, in plain language, what the mentor can and cannot see", () => {
    renderControl();
    // Consent/transparency line: metrics + summary yes, the conversation no.
    expect(screen.getByText(/niet je gesprek/i)).toBeInTheDocument();
  });

  it("has no a11y violations before or after rating", async () => {
    const user = userEvent.setup();
    const { container } = renderControl();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    await user.click(screen.getByRole("button", { name: HELPFUL }));
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
