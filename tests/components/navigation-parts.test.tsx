import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { Breadcrumb } from "~/components/Breadcrumb";
import { Tabs } from "~/components/Tabs";

// Plan "eenvoudiger beheer en navigatie", step 4: a breadcrumb on deep pages, and the
// programme page in three tabs.

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function stub(ui: React.ReactNode, at = "/") {
  const Stub = createRoutesStub([{ path: "/", Component: () => <>{ui}</> }]);
  return render(<Stub initialEntries={[at]} />);
}

describe("Breadcrumb", () => {
  it("links every step back and marks the page you are on", async () => {
    const { container } = stub(
      <Breadcrumb
        label="Kruimelpad"
        items={[
          { label: "Opleidingen", to: "/programmes" },
          { label: "HBO-ICT", to: "/programmes/p1" },
          { label: "Programmeren" },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Kruimelpad" });
    expect(nav).toBeVisible();
    expect(screen.getByRole("link", { name: "Opleidingen" })).toHaveAttribute(
      "href",
      "/programmes",
    );
    expect(screen.getByRole("link", { name: "HBO-ICT" })).toHaveAttribute("href", "/programmes/p1");
    expect(screen.getByText("Programmeren")).toHaveAttribute("aria-current", "page");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("Tabs", () => {
  const tabs = [
    { id: "courses", label: "Cursussen", panel: <p>Alle cursussen</p> },
    { id: "lines", label: "Leerlijnen", panel: <p>Alle leerlijnen</p> },
    { id: "details", label: "Gegevens", panel: <p>Naam en vorm</p> },
  ];

  it("shows the first tab, and moves with the arrow keys, Home and End", async () => {
    const user = userEvent.setup();
    const { container } = stub(<Tabs label="Onderdelen" tabs={tabs} />);
    expect(screen.getByRole("tablist", { name: "Onderdelen" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Cursussen" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Cursussen" })).toHaveTextContent("Alle cursussen");
    expect(screen.getByText("Alle leerlijnen")).not.toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);

    await user.click(screen.getByRole("tab", { name: "Cursussen" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Leerlijnen" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Leerlijnen" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Alle leerlijnen")).toBeVisible();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Gegevens" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Cursussen" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Gegevens" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Cursussen" })).toHaveFocus();
    // Only the chosen tab is in the Tab order.
    expect(screen.getByRole("tab", { name: "Leerlijnen" })).toHaveAttribute("tabindex", "-1");
  });

  it("opens the tab named in the address (?tab=lines)", () => {
    stub(<Tabs label="Onderdelen" tabs={tabs} />, "/?tab=lines");
    expect(screen.getByRole("tab", { name: "Leerlijnen" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
