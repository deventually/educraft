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
    expect(screen.queryByRole("radio")).toBeNull();
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
