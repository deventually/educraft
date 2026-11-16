import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { AddDialog } from "~/components/connections/AddDialog";
import { ConnectionList } from "~/components/connections/ConnectionList";
import { NewDialog } from "~/components/connections/NewDialog";

// One way to add, remove and link everywhere (plan "eenvoudiger beheer en navigatie", step 3):
// "… toevoegen" opens a dialog with search and ticks; "Weghalen" always asks first.

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function stub(ui: React.ReactNode, onPost?: (fd: FormData) => void) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <>{ui}</>,
      action: async ({ request }) => {
        onPost?.(await request.formData());
        return { ok: true };
      },
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

const teams = [
  { id: "t1", label: "Informatica", hint: "8 leden" },
  { id: "t2", label: "Moduleteam Web" },
  { id: "t3", label: "Moduleteam Data" },
];

describe("AddDialog", () => {
  it("opens from its button and adds every ticked item in one go", async () => {
    const user = userEvent.setup();
    let posted: FormData | undefined;
    stub(
      <AddDialog
        triggerLabel="Team toevoegen"
        title="Teams toevoegen aan HBO-ICT"
        intent="link-teams"
        pick={{ name: "teamId", options: teams, empty: "Geen teams meer" }}
      />,
      (fd) => {
        posted = fd;
      },
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Team toevoegen" }));
    const dialog = screen.getByRole("dialog", { name: "Teams toevoegen aan HBO-ICT" });
    const add = within(dialog).getByRole("button", { name: /^Toevoegen/ });
    expect(add).toBeDisabled();
    await user.click(within(dialog).getByRole("checkbox", { name: /Informatica/ }));
    await user.click(within(dialog).getByRole("checkbox", { name: "Moduleteam Data" }));
    expect(add).toHaveAccessibleName("Toevoegen (2)");
    await user.click(add);
    expect(posted?.get("intent")).toBe("link-teams");
    expect(posted?.getAll("teamId")).toEqual(["t1", "t3"]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("narrows the list with the search box, and keeps what was ticked", async () => {
    const user = userEvent.setup();
    stub(
      <AddDialog
        triggerLabel="Team toevoegen"
        title="Teams toevoegen"
        intent="link-teams"
        pick={{ name: "teamId", options: teams, empty: "Geen teams meer" }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Team toevoegen" }));
    const dialog = screen.getByRole("dialog");
    // The search box gets the focus, so you can type at once.
    expect(within(dialog).getByRole("searchbox", { name: "Zoeken" })).toHaveFocus();
    await user.click(within(dialog).getByRole("checkbox", { name: /Informatica/ }));
    await user.click(within(dialog).getByRole("searchbox"));
    await user.keyboard("module{Enter}");
    expect(
      within(dialog).getByRole("checkbox", { name: /Informatica/, hidden: true }),
    ).not.toBeVisible();
    expect(within(dialog).getByRole("checkbox", { name: "Moduleteam Web" })).toBeVisible();
    await user.keyboard("zzz");
    expect(within(dialog).getByText("Niets gevonden.")).toBeVisible();
    await user.clear(within(dialog).getByRole("searchbox"));
    expect(within(dialog).getByRole("checkbox", { name: /Informatica/ })).toBeChecked();
  });

  it("says when there is nothing left to add", async () => {
    const user = userEvent.setup();
    stub(
      <AddDialog
        triggerLabel="Team toevoegen"
        title="Teams toevoegen"
        intent="link-teams"
        pick={{ name: "teamId", options: [], empty: "Alle teams horen er al bij." }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Team toevoegen" }));
    expect(screen.getByText("Alle teams horen er al bij.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Toevoegen/ })).toBeNull();
  });

  it("takes its own fields instead of a list, such as an e-mail address", async () => {
    const user = userEvent.setup();
    let posted: FormData | undefined;
    stub(
      <AddDialog triggerLabel="Lid toevoegen" title="Lid toevoegen" intent="addMember">
        <label htmlFor="email">E-mailadres</label>
        <input id="email" name="email" type="email" data-autofocus />
      </AddDialog>,
      (fd) => {
        posted = fd;
      },
    );
    await user.click(screen.getByRole("button", { name: "Lid toevoegen" }));
    await user.keyboard("a@school.nl");
    await user.click(screen.getByRole("button", { name: "Toevoegen" }));
    expect(posted?.get("email")).toBe("a@school.nl");
  });

  it("closes on Escape and gives the focus back to its button", async () => {
    const user = userEvent.setup();
    const { container } = stub(
      <AddDialog
        triggerLabel="Team toevoegen"
        title="Teams toevoegen"
        intent="link-teams"
        pick={{ name: "teamId", options: teams, empty: "-" }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Team toevoegen" }));
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Team toevoegen" })).toHaveFocus();
  });
});

describe("ConnectionList", () => {
  const list = (onPost?: (fd: FormData) => void) =>
    stub(
      <ConnectionList
        title="Teams"
        empty="Nog geen teams."
        add={<button type="button">Team toevoegen</button>}
        items={[
          {
            id: "t1",
            name: "Informatica",
            href: "/teams/t1",
            meta: "8 leden",
            remove: {
              fields: { intent: "unlink-team", teamId: "t1" },
              title: "Informatica weghalen uit HBO-ICT?",
              description: "Het team blijft bestaan.",
            },
          },
          { id: "t2", name: "Moduleteam Web" },
        ]}
      />,
      onPost,
    );

  it("shows a heading with its add button, and a row per item", async () => {
    const { container } = list();
    const section = screen.getByRole("region", { name: "Teams" });
    expect(within(section).getByRole("button", { name: "Team toevoegen" })).toBeVisible();
    const rows = within(section).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByRole("link", { name: "Informatica" })).toHaveAttribute(
      "href",
      "/teams/t1",
    );
    expect(within(rows[0]!).getByText("8 leden")).toBeVisible();
    // A row without `remove` has no Weghalen.
    expect(within(rows[1]!).queryByRole("button")).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("asks before Weghalen, says the item stays, and only then posts", async () => {
    const user = userEvent.setup();
    const posts: FormData[] = [];
    list((fd) => posts.push(fd));
    await user.click(screen.getByRole("button", { name: "Weghalen: Informatica" }));
    const dialog = screen.getByRole("dialog", { name: "Informatica weghalen uit HBO-ICT?" });
    expect(within(dialog).getByText("Het team blijft bestaan.")).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Annuleren" }));
    expect(posts).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Weghalen: Informatica" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Weghalen" }));
    expect(posts[0]?.get("intent")).toBe("unlink-team");
    expect(posts[0]?.get("teamId")).toBe("t1");
  });

  it("says so when the list is empty", () => {
    stub(<ConnectionList title="Teams" empty="Nog geen teams." items={[]} />);
    expect(screen.getByText("Nog geen teams.")).toBeVisible();
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("NewDialog (plan step 6)", () => {
  it("opens from Nieuwe …, with the name field focused, and posts what it holds", async () => {
    const user = userEvent.setup();
    let posted: FormData | undefined;
    const { container } = stub(
      <NewDialog
        triggerLabel="Nieuwe cursus"
        title="Nieuwe cursus"
        intent="create"
        submitLabel="Aanmaken"
      >
        <label htmlFor="n">Naam</label>
        <input id="n" name="name" data-autofocus />
      </NewDialog>,
      (fd) => {
        posted = fd;
      },
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Nieuwe cursus" }));
    const dialog = screen.getByRole("dialog", { name: "Nieuwe cursus" });
    expect(within(dialog).getByLabelText("Naam")).toHaveFocus();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    await user.keyboard("Databases");
    await user.click(within(dialog).getByRole("button", { name: "Aanmaken" }));
    await vi.waitFor(() => expect(posted?.get("name")).toBe("Databases"));
    expect(posted?.get("intent")).toBe("create");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes with Annuleren and gives focus back to its button", async () => {
    const user = userEvent.setup();
    stub(
      <NewDialog
        triggerLabel="Nieuw team"
        title="Nieuw team"
        intent="create"
        submitLabel="Team aanmaken"
      >
        <input aria-label="Naam" name="name" data-autofocus />
      </NewDialog>,
    );
    const trigger = screen.getByRole("button", { name: "Nieuw team" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Annuleren" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
