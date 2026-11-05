import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminUsers from "~/routes/admin.users";
import { ToastProvider } from "~/components/Toast";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const loaderData = {
  origin: "http://localhost",
  selfId: "admin-1",
  // Default viewer: the owner (super admin). Tests for a regular admin override this.
  isOwner: true,
  ownerId: "admin-1",
  // A stale loader shape (with `tools`) must not make the form offer a restriction.
  tools: [
    { slug: "bloom-by-design", name: { nl: "Bloom by Design", en: "Bloom by Design" } },
    { slug: "arcs-reactor", name: { nl: "ARCS Reactor", en: "ARCS Reactor" } },
  ],
  invites: [
    {
      token: "tok-open",
      role: "teacher",
      note: "Jan de Vries",
      email: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      used: false,
      createdByName: "Admin A",
      createdAt: new Date("2026-07-01T10:00:00Z"),
    },
  ],
  // The whole model catalogue + per-teacher rows ("Modellen per docent").
  base: [
    { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6" },
    { id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5" },
    { id: "claude-code", displayName: "Claude Code (CLI)" },
    { id: "ollama::gemma", displayName: "Ollama · gemma" },
  ],
  teachers: [
    {
      id: "t1",
      name: "Teacher One",
      email: "t1@example.com",
      mode: "own",
      models: ["claude-haiku-4-5"],
      portfolio: true,
    },
    // An inheriting teacher's boxes show the instance set (here: Sonnet only).
    {
      id: "t2",
      name: "Teacher Two",
      email: null,
      mode: "inherit",
      models: ["claude-sonnet-4-6"],
      portfolio: false,
    },
  ],
  users: [
    { id: "admin-1", name: "Admin A", email: "a@x.nl", role: "admin", createdAt: new Date() },
    { id: "teacher-9", name: "Teacher T", email: "t@x.nl", role: "teacher", createdAt: new Date() },
  ],
};

function renderRoute(
  action?: (args: { request: Request }) => unknown,
  extraUsers: (typeof loaderData.users)[number][] = [],
  overrides: { isOwner?: boolean; ownerId?: string | null } = {},
) {
  const props = {
    loaderData: { ...loaderData, ...overrides, users: [...loaderData.users, ...extraUsers] },
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

describe("Admin users", () => {
  it("shows a retired role read-only, with no role-change form", async () => {
    const { container } = renderRoute(undefined, [
      { id: "legacy-1", name: "Legacy L", email: "l@x.nl", role: "student", createdAt: new Date() },
    ]);
    await screen.findByText("Legacy L");
    expect(container.querySelector("#role-legacy-1")).toBeNull();
    expect(container.querySelector("#role-teacher-9")).not.toBeNull();
    expect(screen.getByText("student")).toBeTruthy();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("offers no tool restriction when inviting", () => {
    renderRoute();
    expect(screen.queryByLabelText(/beperk tot|restrict/i)).toBeNull();
    expect(screen.queryByLabelText("Bloom by Design")).toBeNull();
    expect(screen.queryByLabelText("ARCS Reactor")).toBeNull();
  });

  it("mints an invite and shows the copyable link (mutation)", async () => {
    const user = userEvent.setup();
    renderRoute();
    await user.click(screen.getByRole("button", { name: /uitnodiging aanmaken|create invite/i }));
    await waitFor(() => {
      expect(screen.getByText("http://localhost/invite/tok-new")).toBeInTheDocument();
    });
  });

  it("offers only teacher and admin in the role select", () => {
    renderRoute();
    const values = screen
      .getAllByRole("combobox")
      .flatMap((s) => Array.from(s.querySelectorAll("option")).map((o) => o.getAttribute("value")));
    expect(values.length).toBeGreaterThan(0);
    for (const v of values) expect(["teacher", "admin"]).toContain(v);
  });

  it("offers a role change for other users but not for the signed-in admin", () => {
    renderRoute();
    // The admin's own row shows no role <select>; only the teacher's does. (The
    // "create an account" form has its own role select, which is not a per-row one.)
    const selects = screen.getAllByLabelText(/rol wijzigen|change role/i);
    expect(selects).toHaveLength(1);
  });

  it("offers reset-password, delete, and email edit for another user (not for self)", () => {
    renderRoute();
    // teacher-9 is the only non-self user → exactly one of each control.
    expect(screen.getByRole("button", { name: /verwijderen|delete/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /wachtwoord resetten|reset password/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mailadres wijzigen|change email address/i)).toBeInTheDocument();
  });

  it("shows the shareable reset link after a reset (mutation)", async () => {
    const user = userEvent.setup();
    renderRoute(() => ({ resetLink: "http://localhost/reset/tok-r" }));
    await user.click(screen.getByRole("button", { name: /wachtwoord resetten|reset password/i }));
    await waitFor(() => {
      expect(screen.getByText("http://localhost/reset/tok-r")).toBeInTheDocument();
    });
  });

  it("pre-checks a teacher's own model set", () => {
    renderRoute();
    expect(
      screen.getByRole("heading", { name: /modellen per docent|models per teacher/i }),
    ).toBeTruthy();
    const group = screen.getByRole("group", { name: "Teacher One" });
    const haiku = within(group).getByLabelText("Claude Haiku 4.5") as HTMLInputElement;
    const sonnet = within(group).getByLabelText("Claude Sonnet 4.6") as HTMLInputElement;
    expect(haiku.checked).toBe(true); // in the own set
    expect(sonnet.checked).toBe(false); // not in the own set
  });

  it("offers inherit/own per teacher; checkboxes are disabled while inheriting", async () => {
    const user = userEvent.setup();
    renderRoute();
    const one = screen.getByRole("group", { name: "Teacher One" });
    const two = screen.getByRole("group", { name: "Teacher Two" });
    const oneOwn = within(one).getByRole("radio", { name: /eigen keuze/i }) as HTMLInputElement;
    const twoInherit = within(two).getByRole("radio", {
      name: /volgt de instelling/i,
    }) as HTMLInputElement;
    expect(oneOwn.checked).toBe(true);
    expect(twoInherit.checked).toBe(true);
    expect((within(one).getByLabelText("Claude Haiku 4.5") as HTMLInputElement).disabled).toBe(
      false,
    );
    expect((within(two).getByLabelText("Claude Haiku 4.5") as HTMLInputElement).disabled).toBe(
      true,
    );
    await user.click(within(two).getByRole("radio", { name: /eigen keuze/i }));
    expect((within(two).getByLabelText("Claude Haiku 4.5") as HTMLInputElement).disabled).toBe(
      false,
    );
  });

  it("lists the whole catalogue for a teacher, not only the instance set", () => {
    renderRoute();
    const group = screen.getByRole("group", { name: "Teacher Two" });
    expect(within(group).getByLabelText("Ollama · gemma")).toBeInTheDocument();
    expect(within(group).getByLabelText("Claude Code (CLI)")).toBeInTheDocument();
  });

  it("has no save buttons", () => {
    renderRoute();
    expect(screen.queryAllByRole("button", { name: /opslaan|save|toepassen|apply/i })).toHaveLength(
      0,
    );
  });

  it("keeps the action buttons (invite, reset, delete)", () => {
    renderRoute();
    expect(
      screen.getByRole("button", { name: /uitnodiging aanmaken|create invite/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /wachtwoord resetten|reset password/i }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /verwijderen|delete/i })).toBeTruthy();
  });

  it("autosaves a role change from the select, with one toast (mutation)", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { roleChanged: true };
    });
    await user.selectOptions(screen.getByLabelText(/rol wijzigen|change role/i), "admin");
    await waitFor(() => expect(screen.getAllByRole("status")).toHaveLength(1));
    expect(screen.getByRole("status")).toHaveTextContent(/opgeslagen|saved/i);
    expect(body?.get("intent")).toBe("role");
    expect(body?.get("userId")).toBe("teacher-9");
    expect(body?.get("role")).toBe("admin");
  });

  it("autosaves an e-mail on blur and reverts it with an error toast when refused", async () => {
    const user = userEvent.setup();
    const bodies: FormData[] = [];
    renderRoute(async ({ request }) => {
      bodies.push(await request.formData());
      return { error: "emailTaken" };
    });
    const email = screen.getByLabelText(/e-mailadres wijzigen|change email address/i);
    await user.clear(email);
    await user.type(email, "nieuw@x.nl");
    expect(bodies).toHaveLength(0);
    await user.tab();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(bodies).toHaveLength(1);
    expect(bodies[0].get("intent")).toBe("setEmail");
    expect(bodies[0].get("email")).toBe("nieuw@x.nl");
    expect((email as HTMLInputElement).value).toBe("t@x.nl"); // sprong terug
    expect(screen.queryByText("nieuw@x.nl")).toBeNull();
  });

  it("switches the BDB/BKE workplace per teacher with autosave (P27)", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    const { container } = renderRoute(async ({ request }) => {
      body = await request.formData();
      return { saved: true };
    });
    expect(screen.getByRole("heading", { level: 2, name: "BDB/BKE per docent" })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "BDB/BKE aan voor Teacher One" })).toBeChecked();
    const two = screen.getByRole("checkbox", { name: "BDB/BKE aan voor Teacher Two" });
    expect(two).not.toBeChecked();
    await user.click(two);
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(body?.get("intent")).toBe("portfolioAccess");
    expect(body?.get("userId")).toBe("t2");
    expect(body?.get("enabled")).toBe("1");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("autosaves switching a teacher to an own selection, with the prefilled set", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { saved: true };
    });
    const two = screen.getByRole("group", { name: "Teacher Two" });
    await user.click(within(two).getByRole("radio", { name: /eigen keuze/i }));
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(body?.get("intent")).toBe("teacherModels");
    expect(body?.get("userId")).toBe("t2");
    expect(body?.get("mode")).toBe("own");
    expect(body?.getAll("models")).toEqual(["claude-sonnet-4-6"]);
  });

  it("autosaves switching back to the instance set (no models sent)", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { saved: true };
    });
    const one = screen.getByRole("group", { name: "Teacher One" });
    await user.click(within(one).getByRole("radio", { name: /volgt de instelling/i }));
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(body?.get("mode")).toBe("inherit");
    expect(body?.getAll("models")).toEqual([]);
  });

  it("reverts the radio and boxes when the last model is unchecked and the server refuses", async () => {
    const user = userEvent.setup();
    renderRoute(() => ({ error: "atLeastOne" }));
    const one = screen.getByRole("group", { name: "Teacher One" });
    const haiku = within(one).getByLabelText("Claude Haiku 4.5") as HTMLInputElement;
    await user.click(haiku);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/minstens één model|at least one model/i);
    });
    expect(haiku.checked).toBe(true);
  });

  it("restores the inherit state of the boxes after a refused switch to inherit", async () => {
    const user = userEvent.setup();
    renderRoute(() => ({ error: "unknown" }));
    const one = screen.getByRole("group", { name: "Teacher One" });
    await user.click(within(one).getByRole("radio", { name: /volgt de instelling/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(
      (within(one).getByRole("radio", { name: /eigen keuze/i }) as HTMLInputElement).checked,
    ).toBe(true);
    expect((within(one).getByLabelText("Claude Haiku 4.5") as HTMLInputElement).disabled).toBe(
      false,
    );
  });

  it("keeps each table's sr-only labels inside its own scroll box (no page scroll on a phone)", () => {
    // An `sr-only` label is position:absolute. Without a positioned ancestor inside the
    // `overflow-x-auto` box it escapes that box's clipping and widens the whole page
    // (iPhone 13: a ~690px layout viewport, dialogs off-screen). The box itself must be
    // the containing block.
    const { container } = renderRoute();
    const tables = container.querySelectorAll("table");
    expect(tables.length).toBeGreaterThanOrEqual(2); // invites + users
    for (const table of tables) {
      const box = table.parentElement as HTMLElement;
      expect(box.className).toMatch(/\boverflow-x-auto\b/);
      expect(box.className).toMatch(/\brelative\b/);
    }
  });

  it("has no a11y violations", async () => {
    const { container } = renderRoute();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("Admin users — super admin vs regular admin (P18.6)", () => {
  const otherAdmin = {
    id: "admin-2",
    name: "Admin Two",
    email: "two@x.nl",
    role: "admin",
    createdAt: new Date(),
  };
  const asRegular = { isOwner: false, ownerId: "admin-2" };

  it("shows the role select only to the owner", () => {
    const owner = renderRoute(undefined, [otherAdmin], { isOwner: true, ownerId: "admin-1" });
    expect(owner.container.querySelector("#role-teacher-9")).not.toBeNull();
    expect(owner.container.querySelector("#role-admin-2")).not.toBeNull();
    owner.unmount();
    renderRoute(undefined, [otherAdmin], asRegular);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    // The role is still readable as text.
    expect(screen.getAllByText(/^(beheerder|admin)$/i).length).toBeGreaterThan(0);
  });

  it("hides admin-row actions from a regular admin", () => {
    renderRoute(undefined, [otherAdmin], asRegular);
    // Only the teacher row keeps reset, delete and the e-mail field.
    expect(screen.getAllByRole("button", { name: /verwijderen|delete/i })).toHaveLength(1);
    expect(
      screen.getAllByRole("button", { name: /wachtwoord resetten|reset password/i }),
    ).toHaveLength(1);
    const emailFields = screen.getAllByLabelText(/e-mailadres wijzigen|change email address/i);
    expect(emailFields).toHaveLength(1);
    expect(emailFields[0].getAttribute("id")).toBe("email-teacher-9");
    // The admin's address is read-only text.
    expect(screen.getByText("two@x.nl")).toBeInTheDocument();
  });

  it("gives the owner the actions on every other row, admins included", () => {
    renderRoute(undefined, [otherAdmin], { isOwner: true, ownerId: "admin-1" });
    expect(screen.getAllByRole("button", { name: /verwijderen|delete/i })).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: /wachtwoord resetten|reset password/i }),
    ).toHaveLength(2);
  });

  it("still lets a regular admin act on a teacher and manage teacher models", () => {
    renderRoute(undefined, [], { isOwner: false, ownerId: null });
    expect(screen.getByRole("button", { name: /verwijderen|delete/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Teacher One" })).toBeInTheDocument();
  });

  it("marks the owner with a badge, visible to a regular admin too", () => {
    renderRoute(undefined, [otherAdmin], asRegular);
    const row = screen.getByRole("row", { name: /Admin Two/ });
    expect(within(row).getByText(/^(superbeheerder|super admin)$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^(superbeheerder|super admin)$/i)).toHaveLength(1);
  });

  it("shows no owner badge when no owner is set", () => {
    renderRoute(undefined, [otherAdmin], { isOwner: false, ownerId: null });
    expect(screen.queryByText(/^(superbeheerder|super admin)$/i)).toBeNull();
  });

  it("tells a regular admin that only the super admin manages admins", () => {
    renderRoute(undefined, [otherAdmin], asRegular);
    expect(screen.getByText(/beheert ook beheerders|also manages admins/i)).toBeInTheDocument();
  });

  it("mentions in the invite intro that an invite never makes an admin", () => {
    renderRoute(undefined, [], asRegular);
    expect(screen.getByText(/nooit een beheerder|never makes an admin/i)).toBeTruthy();
  });

  it("shows the owner error as a toast and reverts when the server answers ownerOnly", async () => {
    const user = userEvent.setup();
    renderRoute(() => ({ error: "ownerOnly" }));
    const select = screen.getByLabelText(/rol wijzigen|change role/i) as HTMLSelectElement;
    await user.selectOptions(select, "admin");
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /alleen de superbeheerder kan dit|only the super admin can do this/i,
      ),
    );
    expect(select.value).toBe("teacher");
  });

  it("has no a11y violations for a regular admin and for the owner", async () => {
    const regular = renderRoute(undefined, [otherAdmin], asRegular);
    expect((await axe(regular.container, axeOpts)).violations).toEqual([]);
    regular.unmount();
    const owner = renderRoute(undefined, [otherAdmin], { isOwner: true, ownerId: "admin-2" });
    expect((await axe(owner.container, axeOpts)).violations).toEqual([]);
  });
});

describe("Admin users — owner accounts (P18.7)", () => {
  const dark = {
    id: "teacher-off",
    name: "Dark Teacher",
    email: "dark@x.nl",
    role: "teacher",
    createdAt: new Date(),
    disabled: true,
  };
  const darkAdmin = { ...dark, id: "admin-off", name: "Dark Admin", role: "admin" };
  const asRegular = { isOwner: false, ownerId: "admin-2" };
  const createHeading = /^(account aanmaken|create an account)$/i;

  const createForm = () =>
    screen.getByRole("heading", { name: createHeading }).closest("section") as HTMLElement;

  it("shows the create form only to the owner", () => {
    const owner = renderRoute();
    expect(screen.getByRole("heading", { name: createHeading })).toBeInTheDocument();
    expect(screen.getByLabelText(/^naam$|^name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^e-mailadres$|^email address$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^rol$|^role$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^(account aanmaken|create account)$/i }),
    ).toBeInTheDocument();
    owner.unmount();

    renderRoute(undefined, [], asRegular);
    expect(screen.queryByRole("heading", { name: createHeading })).toBeNull();
    expect(screen.queryByLabelText(/^naam$|^name$/i)).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^(account aanmaken|create account)$/i }),
    ).toBeNull();
  });

  it("puts the create form above the invites", () => {
    renderRoute();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    const create = headings.findIndex((h) => createHeading.test(h ?? ""));
    const invite = headings.findIndex((h) => /docent uitnodigen|invite a teacher/i.test(h ?? ""));
    expect(create).toBeGreaterThanOrEqual(0);
    expect(create).toBeLessThan(invite);
  });

  it("offers teacher and admin as the role of a new account", () => {
    renderRoute();
    const select = screen.getByLabelText(/^rol$|^role$/i) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["teacher", "admin"]);
    expect(select.value).toBe("teacher");
  });

  it("shows the password fields only when 'initial password' is chosen", async () => {
    const user = userEvent.setup();
    renderRoute();
    const link = screen.getByRole("radio", {
      name: /link om zelf|link to choose/i,
    }) as HTMLInputElement;
    const own = screen.getByRole("radio", {
      name: /beginwachtwoord|initial password/i,
    }) as HTMLInputElement;
    // The two ways form a labelled group, the link is the default.
    expect(screen.getByRole("group", { name: /hoe krijgt|how does/i })).toBeInTheDocument();
    expect(link.checked).toBe(true);
    expect(own.checked).toBe(false);
    expect(
      within(createForm()).queryAllByLabelText(/wachtwoord|password/i, {
        selector: "input[type=password]",
      }),
    ).toHaveLength(0);

    await user.click(own);
    const fields = within(createForm()).getAllByLabelText(/wachtwoord|password/i, {
      selector: "input[type=password]",
    });
    expect(fields).toHaveLength(2);
    for (const f of fields) {
      expect(f).toHaveAttribute("autocomplete", "new-password");
      expect(f).toBeRequired();
    }

    await user.click(link);
    expect(
      within(createForm()).queryAllByLabelText(/wachtwoord|password/i, {
        selector: "input[type=password]",
      }),
    ).toHaveLength(0);
  });

  it("posts the new account as a link by default, with no password fields", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { setPasswordLink: "http://localhost/reset/tok-new" };
    });
    await user.type(screen.getByLabelText(/^naam$|^name$/i), "Nieuw Persoon");
    await user.type(screen.getByLabelText(/^e-mailadres$|^email address$/i), "nieuw@x.nl");
    await user.selectOptions(screen.getByLabelText(/^rol$|^role$/i), "admin");
    await user.click(screen.getByRole("button", { name: /^(account aanmaken|create account)$/i }));
    await waitFor(() => expect(body).toBeDefined());
    expect(body?.get("intent")).toBe("createAccount");
    expect(body?.get("name")).toBe("Nieuw Persoon");
    expect(body?.get("email")).toBe("nieuw@x.nl");
    expect(body?.get("role")).toBe("admin");
    expect(body?.get("passwordMode")).toBe("link");
    expect(body?.has("password")).toBe(false);
  });

  it("shows a copyable set-password link card after creating with a link", async () => {
    const user = userEvent.setup();
    renderRoute(() => ({ setPasswordLink: "http://localhost/reset/tok-new" }));
    await user.type(screen.getByLabelText(/^naam$|^name$/i), "Nieuw Persoon");
    await user.type(screen.getByLabelText(/^e-mailadres$|^email address$/i), "nieuw@x.nl");
    await user.click(screen.getByRole("button", { name: /^(account aanmaken|create account)$/i }));
    expect(await screen.findByText("http://localhost/reset/tok-new")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /link om een wachtwoord te kiezen|link to choose a password/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/geef deze link zelf door|pass this link on yourself/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /kopiëren|copy/i })).toBeInTheDocument();
  });

  it("posts the initial password and confirmation, and shows no link", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { accountCreated: true };
    });
    await user.type(screen.getByLabelText(/^naam$|^name$/i), "Pw Persoon");
    await user.type(screen.getByLabelText(/^e-mailadres$|^email address$/i), "pw@x.nl");
    await user.click(screen.getByRole("radio", { name: /beginwachtwoord|initial password/i }));
    const [pw, confirm] = within(createForm()).getAllByLabelText(/wachtwoord|password/i, {
      selector: "input[type=password]",
    });
    await user.type(pw, "initial-secret-123");
    await user.type(confirm, "initial-secret-123");
    await user.click(screen.getByRole("button", { name: /^(account aanmaken|create account)$/i }));
    await waitFor(() => expect(body).toBeDefined());
    expect(body?.get("passwordMode")).toBe("password");
    expect(body?.get("password")).toBe("initial-secret-123");
    expect(body?.get("confirm")).toBe("initial-secret-123");
    // One toast confirms; the password is not echoed anywhere on the page.
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/aangemaakt|created/i),
    );
    expect(screen.queryByText("initial-secret-123")).toBeNull();
    expect(screen.queryByText(/localhost\/reset/)).toBeNull();
  });

  it("shows a refusal of the create form as an error toast", async () => {
    const user = userEvent.setup();
    renderRoute(() => ({ error: "emailTaken" }));
    await user.type(screen.getByLabelText(/^naam$|^name$/i), "Nieuw Persoon");
    await user.type(screen.getByLabelText(/^e-mailadres$|^email address$/i), "taken@x.nl");
    await user.click(screen.getByRole("button", { name: /^(account aanmaken|create account)$/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/al in gebruik|already in use/i),
    );
  });

  it("marks a deactivated user, for a regular admin too", () => {
    const owner = renderRoute(undefined, [dark]);
    const ownerRow = screen.getByRole("row", { name: /Dark Teacher/ });
    expect(within(ownerRow).getByText(/^(non-actief|deactivated)$/i)).toBeInTheDocument();
    // An active user carries no badge.
    const activeRow = screen.getByRole("row", { name: /Teacher T/ });
    expect(within(activeRow).queryByText(/^(non-actief|deactivated)$/i)).toBeNull();
    owner.unmount();

    renderRoute(undefined, [dark], asRegular);
    const regularRow = screen.getByRole("row", { name: /Dark Teacher/ });
    expect(within(regularRow).getByText(/^(non-actief|deactivated)$/i)).toBeInTheDocument();
  });

  it("offers deactivate on an active user and reactivate on a deactivated one", () => {
    renderRoute(undefined, [dark]);
    const active = screen.getByRole("row", { name: /Teacher T/ });
    expect(
      within(active).getByRole("button", { name: /op non-actief zetten|deactivate/i }),
    ).toBeInTheDocument();
    expect(within(active).queryByRole("button", { name: /weer activeren|reactivate/i })).toBeNull();
    const off = screen.getByRole("row", { name: /Dark Teacher/ });
    expect(
      within(off).getByRole("button", { name: /weer activeren|reactivate/i }),
    ).toBeInTheDocument();
    expect(
      within(off).queryByRole("button", { name: /op non-actief zetten|deactivate/i }),
    ).toBeNull();
  });

  it("posts deactivate and reactivate directly, without a confirmation step", async () => {
    const user = userEvent.setup();
    const bodies: FormData[] = [];
    renderRoute(
      async ({ request }) => {
        bodies.push(await request.formData());
        return { statusChanged: true };
      },
      [dark],
    );
    await user.click(
      within(screen.getByRole("row", { name: /Teacher T/ })).getByRole("button", {
        name: /op non-actief zetten|deactivate/i,
      }),
    );
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(bodies[0].get("intent")).toBe("deactivate");
    expect(bodies[0].get("userId")).toBe("teacher-9");
    await user.click(
      within(screen.getByRole("row", { name: /Dark Teacher/ })).getByRole("button", {
        name: /weer activeren|reactivate/i,
      }),
    );
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1].get("intent")).toBe("reactivate");
    expect(bodies[1].get("userId")).toBe("teacher-off");
  });

  it("offers set-password, deactivate and reactivate only to the owner, never on the own row", () => {
    renderRoute(undefined, [dark, darkAdmin]);
    const own = screen.getByRole("row", { name: /Admin A \(/ });
    expect(within(own).queryByRole("button")).toBeNull();
    // 3 other users: a password dialog trigger on each.
    expect(
      screen.getAllByRole("button", { name: /wachtwoord instellen|set password/i }),
    ).toHaveLength(3);
  });

  it("hides every owner-only account action from a regular admin", () => {
    renderRoute(undefined, [dark], asRegular);
    expect(screen.queryByRole("button", { name: /wachtwoord instellen|set password/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /op non-actief zetten|deactivate/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /weer activeren|reactivate/i })).toBeNull();
    // The existing teacher actions stay.
    expect(
      screen.getAllByRole("button", { name: /wachtwoord resetten|reset password/i }).length,
    ).toBeGreaterThan(0);
  });

  it("opens a set-password dialog with two password fields and posts them", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderRoute(async ({ request }) => {
      body = await request.formData();
      return { passwordSet: true };
    });
    await user.click(screen.getByRole("button", { name: /wachtwoord instellen|set password/i }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading")).toHaveTextContent(/Teacher T/);
    const [pw, confirm] = within(dialog).getAllByLabelText(/wachtwoord|password/i, {
      selector: "input[type=password]",
    });
    expect(pw).toHaveAttribute("autocomplete", "new-password");
    expect(confirm).toHaveAttribute("autocomplete", "new-password");
    // Focus moves to the first field.
    expect(document.activeElement).toBe(pw);
    await user.type(pw, "brand-new-secret");
    await user.type(confirm, "brand-new-secret");
    await user.click(
      within(dialog).getByRole("button", { name: /wachtwoord instellen|set password/i }),
    );
    await waitFor(() => expect(body).toBeDefined());
    expect(body?.get("intent")).toBe("setPassword");
    expect(body?.get("userId")).toBe("teacher-9");
    expect(body?.get("password")).toBe("brand-new-secret");
    expect(body?.get("confirm")).toBe("brand-new-secret");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/ingesteld|set/i));
    expect(screen.queryByText("brand-new-secret")).toBeNull();
  });

  it("closes the set-password dialog with Cancel and posts nothing", async () => {
    const user = userEvent.setup();
    let called = false;
    renderRoute(() => {
      called = true;
      return { passwordSet: true };
    });
    await user.click(screen.getByRole("button", { name: /wachtwoord instellen|set password/i }));
    await user.click(screen.getByRole("button", { name: /annuleren|cancel/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(called).toBe(false);
  });

  it("has no a11y violations with the create form, both modes, and the dialog open", async () => {
    const user = userEvent.setup();
    const { container } = renderRoute(undefined, [dark, darkAdmin]);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    await user.click(screen.getByRole("radio", { name: /beginwachtwoord|initial password/i }));
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    await user.click(
      screen.getAllByRole("button", { name: /wachtwoord instellen|set password/i })[0],
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no a11y violations with the link card showing", async () => {
    const user = userEvent.setup();
    const { container } = renderRoute(() => ({
      setPasswordLink: "http://localhost/reset/tok-new",
    }));
    await user.type(screen.getByLabelText(/^naam$|^name$/i), "Nieuw Persoon");
    await user.type(screen.getByLabelText(/^e-mailadres$|^email address$/i), "nieuw@x.nl");
    await user.click(screen.getByRole("button", { name: /^(account aanmaken|create account)$/i }));
    await screen.findByText("http://localhost/reset/tok-new");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
