import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminUsers from "~/routes/admin.users";
import { ToastProvider } from "~/components/Toast";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

type Person = {
  kind: "user" | "invite";
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status: "active" | "invited" | "disabled";
  lastActiveDay: string | null;
  link?: string;
};

const people: Person[] = [
  {
    kind: "invite",
    id: "tok-open",
    name: "Jan de Vries",
    email: null,
    role: "teacher",
    status: "invited",
    lastActiveDay: null,
    link: "http://localhost/invite/tok-open",
  },
  {
    kind: "user",
    id: "admin-1",
    name: "Admin A",
    email: "a@x.nl",
    role: "admin",
    status: "active",
    lastActiveDay: "2026-11-03",
  },
  {
    kind: "user",
    id: "teacher-9",
    name: "Teacher T",
    email: "t@x.nl",
    role: "teacher",
    status: "active",
    lastActiveDay: null,
  },
  {
    kind: "user",
    id: "teacher-off",
    name: "Dark Teacher",
    email: "dark@x.nl",
    role: "teacher",
    status: "disabled",
    lastActiveDay: "2026-10-01",
  },
];

const loaderData = {
  selfId: "admin-1",
  // Default viewer: the owner (super admin). Tests for a regular admin override this.
  isOwner: true,
  ownerId: "admin-1",
  filter: { q: "", role: "", status: "", team: "" },
  teams: [
    { id: "team-1", name: "Verpleegkunde" },
    { id: "team-2", name: "Techniek" },
  ],
  people,
};

function renderRoute(
  action?: (args: { request: Request }) => unknown,
  overrides: Partial<typeof loaderData> = {},
) {
  const props = {
    loaderData: { ...loaderData, ...overrides },
  } as unknown as ComponentProps<typeof AdminUsers>;
  const Stub = createRoutesStub([
    {
      path: "/admin/users",
      Component: () => (
        <ToastProvider>
          <AdminUsers {...props} />
        </ToastProvider>
      ),
      action: action ?? (() => ({ link: "http://localhost/invite/tok-new" })),
    },
  ]);
  return render(<Stub initialEntries={["/admin/users"]} />);
}

const row = (name: RegExp) => screen.getByRole("row", { name });
const openAdd = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: /^(toevoegen|add)$/i }));

describe("Admin user list (P28.1)", () => {
  it("shows one row per person: name, e-mail, role, status and last active", () => {
    renderRoute();
    const t = row(/Teacher T/);
    expect(within(t).getByText("t@x.nl")).toBeInTheDocument();
    expect(within(t).getByText("Docent")).toBeInTheDocument();
    expect(within(t).getByText("Actief")).toBeInTheDocument();
    expect(within(t).getByText("nog niet")).toBeInTheDocument();
    expect(within(row(/Admin A/)).getByText(/3 nov\.? 2026/)).toBeInTheDocument();
    expect(within(row(/Dark Teacher/)).getByText("Non-actief")).toBeInTheDocument();
  });

  it("links each account to its person page", () => {
    renderRoute();
    expect(within(row(/Teacher T/)).getByRole("link", { name: "Teacher T" })).toHaveAttribute(
      "href",
      "/admin/users/teacher-9",
    );
  });

  it("shows an open invite as a row with copy and revoke, and no person page", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { revoked: true };
    });
    const inv = row(/Jan de Vries/);
    expect(within(inv).getByText("Uitgenodigd")).toBeInTheDocument();
    expect(within(inv).queryByRole("link")).toBeNull();
    expect(within(inv).getByRole("button", { name: /link kopiëren/i })).toBeInTheDocument();
    await user.click(within(inv).getByRole("button", { name: /intrekken/i }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /intrekken/i }),
    );
    await waitFor(() => expect(body).toBeDefined());
    expect(body?.get("intent")).toBe("revoke");
    expect(body?.get("token")).toBe("tok-open");
  });

  it("has no separate invites table any more", () => {
    renderRoute();
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: /^uitnodigingen$/i })).toBeNull();
  });

  it("marks the owner and the signed-in admin", () => {
    renderRoute(undefined, { isOwner: false, ownerId: "admin-1", selfId: "teacher-9" });
    expect(within(row(/Admin A/)).getByText(/^superbeheerder$/i)).toBeInTheDocument();
    expect(within(row(/Teacher T/)).getByText(/\(jij\)/)).toBeInTheDocument();
  });

  it("drops the per-row buttons and the per-teacher blocks", () => {
    renderRoute();
    for (const name of [
      /wachtwoord resetten/i,
      /wachtwoord instellen/i,
      /op non-actief zetten/i,
      /^verwijderen$/i,
    ]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    expect(screen.queryByLabelText(/rol wijzigen/i)).toBeNull();
    expect(screen.queryByLabelText(/e-mailadres wijzigen/i)).toBeNull();
    expect(screen.queryByRole("heading", { name: /modellen per docent/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /bdb\/bke per docent/i })).toBeNull();
  });

  it("searches and filters with a GET form, prefilled from the query", () => {
    renderRoute(undefined, {
      filter: { q: "zoë", role: "teacher", status: "invited", team: "team-2" },
    });
    const search = screen.getByRole("search");
    const form = search.tagName === "FORM" ? search : search.querySelector("form");
    expect(form?.getAttribute("method")).toBe("get");
    expect(screen.getByLabelText(/zoek op naam of e-mail/i)).toHaveValue("zoë");
    expect(screen.getByLabelText(/^rol$/i)).toHaveValue("teacher");
    expect(screen.getByLabelText(/^status$/i)).toHaveValue("invited");
    const roles = Array.from((screen.getByLabelText(/^rol$/i) as HTMLSelectElement).options).map(
      (o) => o.value,
    );
    expect(roles).toEqual(["", "teacher", "admin"]);
    const statuses = Array.from(
      (screen.getByLabelText(/^status$/i) as HTMLSelectElement).options,
    ).map((o) => o.value);
    expect(statuses).toEqual(["", "active", "invited", "disabled"]);
    expect(within(search).getByRole("button", { name: /^zoeken$/i })).toBeInTheDocument();
    // P28.2: a filter on team.
    expect(screen.getByLabelText(/^team$/i)).toHaveValue("team-2");
  });

  it("says so when nobody matches", () => {
    renderRoute(undefined, { people: [] });
    expect(screen.getByText(/niemand gevonden/i)).toBeInTheDocument();
  });

  it("keeps the table's sr-only labels inside its own scroll box (no page scroll on a phone)", () => {
    const { container } = renderRoute();
    const box = container.querySelector("table")?.parentElement as HTMLElement;
    expect(box.className).toMatch(/\boverflow-x-auto\b/);
    expect(box.className).toMatch(/\brelative\b/);
  });

  it("has no a11y violations", async () => {
    const { container } = renderRoute();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("Admin user list — one Add button (P28.1)", () => {
  const asRegular = { isOwner: false, ownerId: "admin-2" };

  it("opens one form behind one Add button", async () => {
    const user = userEvent.setup();
    renderRoute();
    const add = screen.getByRole("button", { name: /^toevoegen$/i });
    expect(add).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /uitnodiging aanmaken/i })).toBeNull();
    await openAdd(user);
    expect(add).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /uitnodiging aanmaken/i })).toBeInTheDocument();
  });

  it("mints an invite and shows the copyable link (mutation)", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { link: "http://localhost/invite/tok-new" };
    });
    await openAdd(user);
    await user.type(screen.getByLabelText(/notitie/i), "Nieuwe Collega");
    await user.click(screen.getByRole("button", { name: /uitnodiging aanmaken/i }));
    expect(await screen.findByText("http://localhost/invite/tok-new")).toBeInTheDocument();
    expect(body?.get("intent")).toBe("mint");
    expect(body?.get("note")).toBe("Nieuwe Collega");
  });

  it("gives a regular admin only the invite link, never a direct account", async () => {
    const user = userEvent.setup();
    renderRoute(undefined, asRegular);
    await openAdd(user);
    // P28.5: a regular admin chooses between one link and a pasted list; never an account.
    expect(screen.getAllByRole("radio").map((r) => r.getAttribute("value"))).toEqual([
      "invite",
      "list",
    ]);
    expect(screen.queryByRole("radio", { name: /account met wachtwoord/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^account aanmaken$/i })).toBeNull();
    expect(screen.getByRole("button", { name: /uitnodiging aanmaken/i })).toBeInTheDocument();
    expect(screen.getByText(/nooit een beheerder/i)).toBeInTheDocument();
  });

  it("lets the owner choose between an invite link and a direct account", async () => {
    const user = userEvent.setup();
    renderRoute();
    await openAdd(user);
    const how = screen.getByRole("group", { name: /hoe voeg je iemand toe/i });
    const invite = within(how).getByRole("radio", { name: /uitnodigingslink/i });
    const account = within(how).getByRole("radio", { name: /account met wachtwoord/i });
    expect(invite).toBeChecked();
    await user.click(account);
    expect(screen.queryByRole("button", { name: /uitnodiging aanmaken/i })).toBeNull();
    expect(screen.getByRole("button", { name: /^account aanmaken$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^rol$/i, { selector: "#create-role" })).toBeInTheDocument();
  });

  it("posts a direct account as a link by default and shows the link card", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { setPasswordLink: "http://localhost/reset/tok-new" };
    });
    await openAdd(user);
    await user.click(screen.getByRole("radio", { name: /account met wachtwoord/i }));
    await user.type(screen.getByLabelText(/^naam$/i), "Nieuw Persoon");
    await user.type(screen.getByLabelText(/^e-mailadres$/i), "nieuw@x.nl");
    await user.click(screen.getByRole("button", { name: /^account aanmaken$/i }));
    expect(await screen.findByText("http://localhost/reset/tok-new")).toBeInTheDocument();
    expect(body?.get("intent")).toBe("createAccount");
    expect(body?.get("passwordMode")).toBe("link");
    expect(body?.has("password")).toBe(false);
  });

  it("shows a refused direct account as an error toast", async () => {
    const user = userEvent.setup();
    renderRoute(() => ({ error: "emailTaken", form: "create" }));
    await openAdd(user);
    await user.click(screen.getByRole("radio", { name: /account met wachtwoord/i }));
    await user.type(screen.getByLabelText(/^naam$/i), "Nieuw Persoon");
    await user.type(screen.getByLabelText(/^e-mailadres$/i), "taken@x.nl");
    await user.click(screen.getByRole("button", { name: /^account aanmaken$/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/al in gebruik/i));
  });

  it("has no a11y violations with the add form open, in both ways", async () => {
    const user = userEvent.setup();
    const { container } = renderRoute();
    await openAdd(user);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    await user.click(screen.getByRole("radio", { name: /account met wachtwoord/i }));
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("Admin user list — teams (P28.2)", () => {
  it("lets Add choose a team for the invite", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { link: "http://localhost/invite/tok-new" };
    });
    await openAdd(user);
    await user.selectOptions(screen.getByLabelText(/in team/i), "team-1");
    await user.click(screen.getByRole("button", { name: /uitnodiging aanmaken/i }));
    await waitFor(() => expect(body?.get("teamId")).toBe("team-1"));
  });

  it("lets Add choose a team for a direct account too", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { setPasswordLink: "http://localhost/reset/tok" };
    });
    await openAdd(user);
    await user.click(screen.getByRole("radio", { name: /account met wachtwoord/i }));
    await user.type(screen.getByLabelText(/^naam$/i), "Nieuw");
    await user.type(screen.getByLabelText(/^e-mailadres$/i), "n@x.nl");
    await user.selectOptions(screen.getByLabelText(/in team/i), "team-2");
    await user.click(screen.getByRole("button", { name: /^account aanmaken$/i }));
    await waitFor(() => expect(body?.get("teamId")).toBe("team-2"));
  });

  it("offers no team choice when there are no teams", async () => {
    const user = userEvent.setup();
    renderRoute(undefined, { teams: [] });
    await openAdd(user);
    expect(screen.queryByLabelText(/in team/i)).toBeNull();
    expect(screen.queryByLabelText(/^team$/i)).toBeNull();
  });
});

describe("Admin user list: paste a list (P28.5)", () => {
  const pasted = [
    {
      line: 1,
      name: "Jan de Vries",
      email: "jan@school.nl",
      link: "http://localhost/invite/tok-jan",
    },
    { line: 2, text: "Zonder adres", reason: "invalidEmail" },
    { line: 3, text: "Bestaand, b@school.nl", reason: "emailTaken" },
    { line: 4, text: "Weer Jan, jan@school.nl", reason: "duplicate" },
  ];
  const chooseList = async (user: ReturnType<typeof userEvent.setup>) => {
    await openAdd(user);
    await user.click(screen.getByRole("radio", { name: /lijst plakken/i }));
  };

  it("posts the pasted text and the chosen team", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(
      async ({ request }) => {
        body = await request.formData();
        return { pasted };
      },
      { isOwner: false, ownerId: "admin-2" },
    );
    await chooseList(user);
    const box = screen.getByLabelText(/persoon per regel/i);
    await user.type(box, "Jan de Vries, jan@school.nl{enter}Anna, anna@school.nl");
    await user.selectOptions(
      screen.getByLabelText(/^in team$/i, { selector: "#list-team" }),
      "team-2",
    );
    await user.click(screen.getByRole("button", { name: /uitnodigingen aanmaken/i }));
    await waitFor(() => expect(body).toBeDefined());
    expect(body?.get("intent")).toBe("mintList");
    expect(body?.get("people")).toBe("Jan de Vries, jan@school.nl\nAnna, anna@school.nl");
    expect(body?.get("teamId")).toBe("team-2");
  });

  it("shows a table: a link to copy per person, or the reason it was refused", async () => {
    const user = userEvent.setup();
    renderRoute(() => ({ pasted }));
    await chooseList(user);
    await user.type(screen.getByLabelText(/persoon per regel/i), "x");
    await user.click(screen.getByRole("button", { name: /uitnodigingen aanmaken/i }));
    const table = await screen.findByRole("table", { name: /uitkomst/i });
    const jan = within(table).getByRole("row", { name: /jan de vries/i });
    expect(within(jan).getByText("jan@school.nl")).toBeInTheDocument();
    expect(within(jan).getByText("http://localhost/invite/tok-jan")).toBeInTheDocument();
    expect(within(jan).getByRole("button", { name: /link kopiëren/i })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: /zonder adres/i })).toHaveTextContent(
      /geen geldig e-mailadres/i,
    );
    expect(within(table).getByRole("row", { name: /bestaand/i })).toHaveTextContent(
      /heeft al een account/i,
    );
    expect(within(table).getByRole("row", { name: /weer jan/i })).toHaveTextContent(
      /staat al eerder in de lijst/i,
    );
    // The summary is a toast, shown once navigation is idle again: wait for it.
    expect(
      await screen.findByText(/1 uitnodiging gemaakt, 3 regels geweigerd/i),
    ).toBeInTheDocument();
  });

  it("has no a11y violations, before and after", async () => {
    const user = userEvent.setup();
    const { container } = renderRoute(() => ({ pasted }));
    await chooseList(user);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    await user.type(screen.getByLabelText(/persoon per regel/i), "x");
    await user.click(screen.getByRole("button", { name: /uitnodigingen aanmaken/i }));
    await screen.findByRole("table", { name: /uitkomst/i });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("Admin user list: change many people at once", () => {
  const recorder = () => {
    const bodies: FormData[] = [];
    const action = async ({ request }: { request: Request }) => {
      bodies.push(await request.formData());
      return { bulk: { done: 2, skipped: 0 } };
    };
    return { bodies, action };
  };

  it("has a tick box per account, none on an open invite", () => {
    renderRoute();
    expect(
      within(row(/Teacher T/)).getByRole("checkbox", { name: /teacher t selecteren/i }),
    ).toBeInTheDocument();
    expect(within(row(/Jan de Vries/)).queryByRole("checkbox")).toBeNull();
  });

  it("ticks every account at once and counts them", async () => {
    const user = userEvent.setup();
    renderRoute();
    await user.click(screen.getByRole("checkbox", { name: /alles selecteren/i }));
    for (const name of [/admin a selecteren/i, /teacher t selecteren/i, /dark teacher selecteren/i])
      expect(screen.getByRole("checkbox", { name })).toBeChecked();
    expect(screen.getByText(/3 geselecteerd/i)).toBeInTheDocument();
  });

  it("puts the ticked people in a team in one go", async () => {
    const user = userEvent.setup();
    const { bodies, action } = recorder();
    renderRoute(action);
    await user.click(screen.getByRole("checkbox", { name: /teacher t selecteren/i }));
    await user.click(screen.getByRole("checkbox", { name: /dark teacher selecteren/i }));
    const bar = screen.getByRole("form", { name: /met geselecteerde/i });
    await user.selectOptions(within(bar).getByLabelText(/^actie$/i), "addTeam");
    await user.selectOptions(within(bar).getByLabelText(/^welk team$/i), "team-2");
    await user.click(within(bar).getByRole("button", { name: /toepassen/i }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!.get("intent")).toBe("bulk");
    expect(bodies[0]!.get("action")).toBe("addTeam");
    expect(bodies[0]!.get("teamId")).toBe("team-2");
    expect(bodies[0]!.getAll("userIds")).toEqual(["teacher-9", "teacher-off"]);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/2 aangepast/i));
  });

  it("offers deactivate and reactivate to the owner only", () => {
    const { unmount } = renderRoute();
    const actions = () =>
      within(screen.getByLabelText(/^actie$/i))
        .getAllByRole("option")
        .map((o) => (o as HTMLOptionElement).value);
    expect(actions()).toEqual(expect.arrayContaining(["deactivate", "reactivate"]));
    unmount();
    renderRoute(undefined, { isOwner: false });
    expect(actions()).not.toContain("deactivate");
    expect(actions()).toEqual(["addTeam", "removeTeam"]);
  });

  it("asks before deactivating, then posts every ticked person", async () => {
    const user = userEvent.setup();
    const { bodies, action } = recorder();
    renderRoute(action);
    await user.click(screen.getByRole("checkbox", { name: /teacher t selecteren/i }));
    await user.click(screen.getByRole("checkbox", { name: /dark teacher selecteren/i }));
    await user.selectOptions(screen.getByLabelText(/^actie$/i), "deactivate");
    await user.click(screen.getByRole("button", { name: /toepassen/i }));
    expect(bodies).toHaveLength(0);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/2 mensen op non-actief zetten/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/overal uitgelogd/i)).toBeInTheDocument();
    // Only hidden fields inside: the focus still moves into the dialog, onto Cancel.
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: /annuleren/i })).toHaveFocus(),
    );
    await user.click(within(dialog).getByRole("button", { name: /op non-actief zetten/i }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!.get("intent")).toBe("bulk");
    expect(bodies[0]!.get("action")).toBe("deactivate");
    expect(bodies[0]!.getAll("userIds")).toEqual(["teacher-9", "teacher-off"]);
  });

  it("says how many were skipped", async () => {
    const user = userEvent.setup();
    renderRoute(() => ({ bulk: { done: 1, skipped: 1 } }));
    await user.click(screen.getByRole("checkbox", { name: /admin a selecteren/i }));
    await user.click(screen.getByRole("button", { name: /toepassen/i }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/1 aangepast, 1 overgeslagen/i),
    );
  });

  it("has no a11y violations with people ticked", async () => {
    const user = userEvent.setup();
    const { container } = renderRoute();
    await user.click(screen.getByRole("checkbox", { name: /alles selecteren/i }));
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("Admin user list: with nothing to do in bulk", () => {
  it("shows team actions only when there are teams, and no tick boxes when nothing is left", () => {
    const { unmount } = renderRoute(undefined, { teams: [] });
    expect(
      within(screen.getByLabelText(/^actie$/i))
        .getAllByRole("option")
        .map((o) => (o as HTMLOptionElement).value),
    ).toEqual(["deactivate", "reactivate"]);
    unmount();
    renderRoute(undefined, { teams: [], isOwner: false });
    expect(screen.queryByRole("form", { name: /met geselecteerde/i })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /selecteren/i })).toBeNull();
  });
});
