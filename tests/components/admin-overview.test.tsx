import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminOverview from "~/routes/admin._index";
import { setupSteps } from "~/lib/admin/setup";

// Beheer → Overzicht en inrichten: where a lay admin starts. The setup list says in which order
// to set up the institution and what is done; below it, every admin page with what it is for.

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const steps = setupSteps({
  kindChosen: false,
  divisions: 2,
  users: 5,
  teams: 1,
  teamsWithoutMembers: 1,
  programmes: 0,
  programmesWithoutDivision: 0,
  programmesWithoutTeam: 0,
});

const counts = { users: 5, teams: 1, programmes: 0, divisions: 2 };

function page(isOwner = false) {
  const Stub = createRoutesStub([
    {
      path: "/admin",
      Component: () => (
        <AdminOverview
          {...({ loaderData: { steps, isOwner, counts } } as object as Parameters<
            typeof AdminOverview
          >[0])}
        />
      ),
    },
  ]);
  return render(<Stub initialEntries={["/admin"]} />);
}

describe("Beheer overview", () => {
  it("lists the six setup steps in order, each with where to do it", () => {
    page();
    const list = screen.getByRole("list", { name: "Inrichten" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(6);
    expect(items[0]).toHaveTextContent("Kies het woord");
    expect(items[2]).toHaveTextContent("Maak de opleidingen aan");
    // With faculties, a programme is made in its faculty.
    expect(within(items[2]!).getByRole("link")).toHaveAttribute("href", "/admin/organisation");
    expect(items[5]).toHaveTextContent("Koppel elk team aan zijn opleidingen");
  });

  it("gives every step a heading, so a screen reader can jump from step to step", () => {
    page();
    const list = screen.getByRole("list", { name: "Inrichten" });
    expect(within(list).getAllByRole("heading", { level: 3 })).toHaveLength(6);
  });

  it("says per step whether it is done, still to do, or optional", () => {
    page();
    const items = within(screen.getByRole("list", { name: "Inrichten" })).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Optioneel");
    expect(items[1]).toHaveTextContent("Klaar");
    expect(items[3]).toHaveTextContent("Klaar");
    expect(items[4]).toHaveTextContent("Nog te doen");
  });

  it("counts the required steps that are done", () => {
    page();
    expect(screen.getByText("1 van 4 vaste stappen klaar")).toBeInTheDocument();
  });

  it("shows every admin page with a line on what it is for", () => {
    page();
    const all = screen.getByRole("region", { name: "Alles van Beheer" });
    expect(within(all).getByRole("link", { name: "Faculteiten en opleidingen" })).toHaveAttribute(
      "href",
      "/admin/organisation",
    );
    expect(within(all).getByText("Accounts, rollen en uitnodigingen.")).toBeInTheDocument();
    expect(within(all).queryByRole("link", { name: "Overzicht en inrichten" })).toBeNull();
    expect(within(all).queryByRole("link", { name: "Recente fouten" })).toBeNull();
  });

  it("shows Recente fouten to the owner", () => {
    page(true);
    expect(screen.getByRole("link", { name: "Recente fouten" })).toHaveAttribute(
      "href",
      "/admin/errors",
    );
  });

  it("starts with the key numbers, each a link to its page", () => {
    page();
    const numbers = screen.getByRole("region", { name: "In cijfers" });
    expect(within(numbers).getByRole("link", { name: "5 gebruikers" })).toHaveAttribute(
      "href",
      "/admin/users",
    );
    expect(within(numbers).getByRole("link", { name: "1 team" })).toHaveAttribute("href", "/teams");
    expect(within(numbers).getByRole("link", { name: "0 opleidingen" })).toHaveAttribute(
      "href",
      "/programmes",
    );
    expect(within(numbers).getByRole("link", { name: "2 faculteiten" })).toHaveAttribute(
      "href",
      "/admin/organisation",
    );
  });

  it("has no a11y violations", async () => {
    const { container } = page();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
