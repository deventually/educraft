import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { ContextWizard } from "~/components/context/ContextWizard";

// happy-dom loads no stylesheet, so axe can't compute real contrast. Without a
// root loader the real i18n resolves to Dutch (DEFAULT_LOCALE), so assert the
// Dutch labels (next=Volgende, back=Vorige, finish=Profiel opslaan).
const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderWizard() {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <ContextWizard onCancel={() => {}} /> },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

const nextBtn = () => screen.getByRole("button", { name: /volgende|next/i });

describe("ContextWizard", () => {
  it("starts on step 1 of 4 with a name field and a disabled next button", () => {
    renderWizard();
    expect(screen.getByText(/stap 1 van 4|step 1 of 4/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/naam|name/i)).toBeInTheDocument();
    // Cannot advance until the profile is named.
    expect(nextBtn()).toBeDisabled();
  });

  it("enables next after a name is typed and advances to step 2 (level & EQF)", async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByLabelText(/naam|name/i), "SE jaar 3");
    expect(nextBtn()).toBeEnabled();
    await user.click(nextBtn());

    expect(screen.getByText(/stap 2 van 4|step 2 of 4/i)).toBeInTheDocument();
    // The full EQF 1–8 ladder lives on step 2, defaulting to EQF 6.
    const eqf = screen.getByLabelText(/eqf/i) as HTMLSelectElement;
    const values = Array.from(eqf.querySelectorAll("option")).map((o) => o.value);
    expect(values).toEqual(["", "1", "2", "3", "4", "5", "6", "7", "8"]);
    expect(eqf).toHaveValue("6");
  });

  it("preserves the entered name when stepping back (steps are hidden, not unmounted)", async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByLabelText(/naam|name/i), "SE jaar 3");
    await user.click(nextBtn());
    expect(screen.getByText(/stap 2 van 4|step 2 of 4/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /vorige|back/i }));
    expect(screen.getByText(/stap 1 van 4|step 1 of 4/i)).toBeInTheDocument();
    // The value survived the round-trip.
    expect(screen.getByLabelText(/naam|name/i)).toHaveValue("SE jaar 3");
  });

  it("reaches the recap on the final step with an enabled finish submit", async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByLabelText(/naam|name/i), "SE jaar 3");
    await user.click(nextBtn()); // → step 2
    await user.click(nextBtn()); // → step 3
    await user.click(nextBtn()); // → step 4

    expect(screen.getByText(/stap 4 van 4|step 4 of 4/i)).toBeInTheDocument();
    expect(screen.getByText(/je maakt aan|recap/i)).toBeInTheDocument();
    // Finish submits the whole form; enabled because a name is present.
    expect(screen.getByRole("button", { name: /profiel opslaan|finish/i })).toBeEnabled();
  });

  it("has no a11y violations on step 1", async () => {
    const { container } = renderWizard();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no a11y violations on the recap step", async () => {
    const user = userEvent.setup();
    const { container } = renderWizard();
    await user.type(screen.getByLabelText(/naam|name/i), "SE jaar 3");
    await user.click(nextBtn());
    await user.click(nextBtn());
    await user.click(nextBtn());
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
