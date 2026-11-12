import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { SlidePreview } from "~/components/export/SlidePreview";
import type { SlideDeck } from "~/lib/export/slides";

const deck: SlideDeck = {
  title: "Les voorbereiden",
  locale: "nl",
  slides: [
    {
      title: "Leerdoel en succescriterium",
      points: ["De student rekent."],
      notes: "",
    },
    {
      title: "Voorkennis ophalen (10 min)",
      points: ["Wat is een rechthoek?"],
      notes: "De docent stelt drie vragen.",
    },
    { title: "Afsluiting (5 min)", points: [], notes: "" },
  ],
};

function show() {
  const Stub = createRoutesStub([{ path: "/", Component: () => <SlidePreview deck={deck} /> }]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("SlidePreview (P30.4)", () => {
  it("shows the first slide: its title as a heading, its points, and where it is", () => {
    show();
    expect(screen.getByRole("heading", { name: "Leerdoel en succescriterium" })).toBeTruthy();
    expect(screen.getByRole("listitem").textContent).toBe("De student rekent.");
    expect(screen.getByText("Dia 1 van 3").getAttribute("aria-live")).toBe("polite");
  });

  it("goes to the next and previous slide, and shows the speaker notes", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Volgende dia" }));
    expect(screen.getByRole("heading", { name: "Voorkennis ophalen (10 min)" })).toBeTruthy();
    expect(screen.getByText("Dia 2 van 3")).toBeTruthy();
    expect(screen.getByText("De docent stelt drie vragen.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Vorige dia" }));
    expect(screen.getByText("Dia 1 van 3")).toBeTruthy();
  });

  it("stays put at either end, without taking the button away from the keyboard", () => {
    show();
    const previous = screen.getByRole("button", { name: "Vorige dia" });
    expect(previous).toHaveAttribute("aria-disabled", "true");
    expect(previous).not.toHaveAttribute("disabled");
    fireEvent.click(previous);
    expect(screen.getByText("Dia 1 van 3")).toBeTruthy();
    const next = screen.getByRole("button", { name: "Volgende dia" });
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);
    expect(screen.getByText("Dia 3 van 3")).toBeTruthy();
    expect(next).toHaveAttribute("aria-disabled", "true");
  });

  it("works by keyboard: Tab to the buttons, Enter and Space turn the slide", async () => {
    const user = userEvent.setup();
    show();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Vorige dia" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Volgende dia" }));
    await user.keyboard("{Enter}");
    expect(screen.getByText("Dia 2 van 3")).toBeTruthy();
    await user.keyboard(" ");
    expect(screen.getByText("Dia 3 van 3")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Volgende dia" }));
  });

  it("lets a long slide grow instead of scrolling inside a box no keyboard can reach", () => {
    const { container } = show();
    expect(container.querySelector(".overflow-auto, .overflow-y-auto, .aspect-video")).toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = show();
    expect((await axe(container)).violations).toEqual([]);
  });
});
