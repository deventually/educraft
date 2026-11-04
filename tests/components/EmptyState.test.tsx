import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { axe } from "vitest-axe";
import { EmptyState } from "~/components/EmptyState";

// happy-dom loads no stylesheet, so axe can't compute real contrast.
const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderLink() {
  return render(
    <MemoryRouter>
      <main>
        <h1>Mijn werk</h1>
        <EmptyState
          title="Nog geen werk bewaard"
          body="Alles wat je maakt, komt hier vanzelf te staan."
          action={{ to: "/tools", label: "Kies een tool" }}
        />
      </main>
    </MemoryRouter>,
  );
}

describe("EmptyState", () => {
  it("renders a heading, one sentence and one action link", () => {
    renderLink();
    expect(screen.getByRole("heading", { level: 2, name: "Nog geen werk bewaard" })).toBeVisible();
    expect(screen.getByText("Alles wat je maakt, komt hier vanzelf te staan.")).toBeVisible();
    const link = screen.getByRole("link", { name: "Kies een tool" });
    expect(link).toHaveAttribute("href", "/tools");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders a button action and calls onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <main>
        <h1>Onderwijscontext</h1>
        <EmptyState title="Leeg" body="Begin hier." action={{ onClick, label: "Instellen" }} />
      </main>,
    );
    expect(screen.queryByRole("link")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Instellen" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is not a live region", () => {
    const { container } = renderLink();
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  it("has no a11y violations", async () => {
    const { container } = renderLink();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
