import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { ConfirmDialog } from "~/components/ConfirmDialog";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderDialog(extra: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <ConfirmDialog
          triggerLabel="Verwijderen"
          title="Cohort verwijderen?"
          description="Dit kan niet ongedaan worden gemaakt."
          confirmLabel="Verwijderen"
          cancelLabel="Annuleren"
          fields={{ intent: "delete", id: "c1" }}
          {...extra}
        />
      ),
      action: () => ({ ok: true }),
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("ConfirmDialog", () => {
  it("keeps the dialog closed until the trigger is clicked", async () => {
    const user = userEvent.setup();
    renderDialog();
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Verwijderen" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Cohort verwijderen?");
  });

  it("closes on Cancel and on Escape", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Verwijderen" }));
    await user.click(screen.getByRole("button", { name: "Annuleren" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Verwijderen" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("gates the confirm button behind typing the exact word", async () => {
    const user = userEvent.setup();
    renderDialog({ typeToConfirm: { word: "Jan de Vries", label: "Typ de naam" } });
    await user.click(screen.getByRole("button", { name: "Verwijderen" }));

    const dialog = screen.getByRole("dialog");
    const confirm = screen.getAllByRole("button", { name: "Verwijderen" }).at(-1)!;
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText("Typ de naam"), "Jan de Vries");
    expect(confirm).toBeEnabled();
    expect(dialog).toBeInTheDocument();
  });

  it("has no a11y violations when closed", async () => {
    const { container } = renderDialog();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no a11y violations when open (with type-to-confirm)", async () => {
    const user = userEvent.setup();
    const { container } = renderDialog({
      typeToConfirm: { word: "DELETE", label: "Typ DELETE" },
    });
    await user.click(screen.getByRole("button", { name: "Verwijderen" }));
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
