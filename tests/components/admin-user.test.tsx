import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminUser from "~/routes/admin.users.$id";
import { ToastProvider } from "~/components/Toast";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const teacher = {
  id: "teacher-9",
  name: "Teacher T",
  email: "t@x.nl",
  role: "teacher",
  status: "active" as "active" | "disabled",
  lastActiveDay: null as string | null,
  ownerBadge: false,
};

const base = [
  { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5" },
  { id: "ollama::gemma", displayName: "Ollama · gemma" },
];

const loaderData = {
  // Default viewer: the owner (super admin), looking at a teacher.
  isOwner: true,
  isSelf: false,
  canManage: true,
  person: teacher,
  models: { base, mode: "own", models: ["claude-haiku-4-5"] } as {
    base: typeof base;
    mode: "own" | "inherit";
    models: string[];
  } | null,
  portfolio: true as boolean | null,
};

type Data = typeof loaderData;

function renderPage(
  action?: (args: { request: Request }) => unknown,
  overrides: Partial<Omit<Data, "person">> & { person?: Partial<Data["person"]> } = {},
) {
  const data = { ...loaderData, ...overrides, person: { ...teacher, ...overrides.person } };
  const props = { loaderData: data } as unknown as ComponentProps<typeof AdminUser>;
  const Stub = createRoutesStub([
    {
      path: "/admin/users/:id",
      Component: () => (
        <ToastProvider>
          <AdminUser {...props} />
        </ToastProvider>
      ),
      action: action ?? (() => ({ saved: true })),
    },
  ]);
  return render(<Stub initialEntries={[`/admin/users/${data.person.id}`]} />);
}

const section = (name: RegExp) =>
  screen.getByRole("heading", { level: 2, name }).closest("section") as HTMLElement;

describe("Admin person page (P28.1)", () => {
  it("names the person, links back to the list, and has the four sections", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Teacher T" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /alle gebruikers/i })).toHaveAttribute(
      "href",
      "/admin/users",
    );
    const h2 = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(h2).toEqual(["Account", "Modellen", "Toegang", "Verwijderen"]);
  });

  it("shows status and last active in the account section", () => {
    renderPage(undefined, { person: { status: "disabled", lastActiveDay: "2026-11-03" } });
    const account = section(/^account$/i);
    expect(within(account).getByText("Non-actief")).toBeInTheDocument();
    expect(within(account).getByText(/3 nov\.? 2026/)).toBeInTheDocument();
  });

  it("autosaves an e-mail on blur, for the user in the URL", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderPage(async ({ request }) => {
      body = await request.formData();
      return { emailSet: true };
    });
    const email = screen.getByLabelText(/^e-mailadres$/i);
    await user.clear(email);
    await user.type(email, "nieuw@x.nl");
    await user.tab();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/opgeslagen/i));
    expect(body?.get("intent")).toBe("setEmail");
    expect(body?.get("email")).toBe("nieuw@x.nl");
  });

  it("reverts a refused e-mail with an error toast", async () => {
    const user = userEvent.setup();
    renderPage(() => ({ error: "emailTaken" }));
    const email = screen.getByLabelText(/^e-mailadres$/i);
    await user.clear(email);
    await user.type(email, "nieuw@x.nl");
    await user.tab();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/al in gebruik/i));
    expect(email).toHaveValue("t@x.nl");
  });

  it("autosaves a role change (owner only), with teacher and admin as the only options", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderPage(async ({ request }) => {
      body = await request.formData();
      return { roleChanged: true };
    });
    const select = screen.getByLabelText(/^rol$/i) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["teacher", "admin"]);
    await user.selectOptions(select, "admin");
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(body?.get("intent")).toBe("role");
    expect(body?.get("role")).toBe("admin");
  });

  it("shows the role as text to a regular admin, and for a retired role", () => {
    const regular = renderPage(undefined, { isOwner: false });
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(within(section(/^account$/i)).getByText("Docent")).toBeInTheDocument();
    regular.unmount();
    renderPage(undefined, { person: { role: "student" }, models: null, portfolio: null });
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("student")).toBeInTheDocument();
  });

  it("offers inherit/own models; the boxes are disabled while inheriting", async () => {
    const user = userEvent.setup();
    renderPage(undefined, {
      models: { base, mode: "inherit", models: ["claude-sonnet-4-6"] },
    });
    const group = screen.getByRole("group", { name: "Teacher T" });
    expect(within(group).getByRole("radio", { name: /volgt de instelling/i })).toBeChecked();
    const haiku = within(group).getByLabelText("Claude Haiku 4.5") as HTMLInputElement;
    expect(haiku.disabled).toBe(true);
    // The whole catalogue, not only the instance set.
    expect(within(group).getByLabelText("Ollama · gemma")).toBeInTheDocument();
    await user.click(within(group).getByRole("radio", { name: /eigen keuze/i }));
    expect(haiku.disabled).toBe(false);
  });

  it("has no models section for an admin", () => {
    renderPage(undefined, { person: { role: "admin" }, models: null, portfolio: null });
    expect(screen.queryByRole("heading", { level: 2, name: /^modellen$/i })).toBeNull();
  });

  it("switches the BDB/BKE workplace with autosave (P27)", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderPage(
      async ({ request }) => {
        body = await request.formData();
        return { saved: true };
      },
      { portfolio: false },
    );
    const box = within(section(/^toegang$/i)).getByRole("checkbox", {
      name: /bdb\/bke-werkplaats/i,
    });
    expect(box).not.toBeChecked();
    await user.click(box);
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(body?.get("intent")).toBe("portfolioAccess");
    expect(body?.get("enabled")).toBe("1");
  });

  it("shows the shareable reset link after a reset (mutation)", async () => {
    const user = userEvent.setup();
    renderPage(() => ({ resetLink: "http://localhost/reset/tok-r" }));
    await user.click(screen.getByRole("button", { name: /wachtwoord resetten/i }));
    expect(await screen.findByText("http://localhost/reset/tok-r")).toBeInTheDocument();
  });

  it("opens the set-password dialog and posts both fields (owner)", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderPage(async ({ request }) => {
      body = await request.formData();
      return { passwordSet: true };
    });
    await user.click(screen.getByRole("button", { name: /wachtwoord instellen/i }));
    const dialog = screen.getByRole("dialog");
    const [pw, confirm] = within(dialog).getAllByLabelText(/wachtwoord/i, {
      selector: "input[type=password]",
    });
    await user.type(pw, "brand-new-secret");
    await user.type(confirm, "brand-new-secret");
    await user.click(within(dialog).getByRole("button", { name: /wachtwoord instellen/i }));
    await waitFor(() => expect(body).toBeDefined());
    expect(body?.get("intent")).toBe("setPassword");
    expect(body?.get("password")).toBe("brand-new-secret");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/ingesteld/i));
  });

  it("posts deactivate on an active user and reactivate on a deactivated one (owner)", async () => {
    const user = userEvent.setup();
    const bodies: FormData[] = [];
    const action = async ({ request }: { request: Request }) => {
      bodies.push(await request.formData());
      return { statusChanged: true };
    };
    const active = renderPage(action);
    expect(screen.queryByRole("button", { name: /weer activeren/i })).toBeNull();
    await user.click(screen.getByRole("button", { name: /op non-actief zetten/i }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0].get("intent")).toBe("deactivate");
    active.unmount();
    renderPage(action, { person: { status: "disabled" } });
    await user.click(screen.getByRole("button", { name: /weer activeren/i }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1].get("intent")).toBe("reactivate");
  });

  it("hides the owner-only actions from a regular admin, and keeps reset and delete", () => {
    renderPage(undefined, { isOwner: false });
    expect(screen.queryByRole("button", { name: /wachtwoord instellen/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /op non-actief zetten/i })).toBeNull();
    expect(screen.getByRole("button", { name: /wachtwoord resetten/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^verwijderen$/i })).toBeInTheDocument();
  });

  it("deletes only after typing the name", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    renderPage(async ({ request }) => {
      body = await request.formData();
      return null;
    });
    await user.click(
      within(section(/^verwijderen$/i)).getByRole("button", { name: /verwijderen/i }),
    );
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: /^verwijderen$/i });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "Teacher T");
    await user.click(confirm);
    await waitFor(() => expect(body?.get("intent")).toBe("deleteUser"));
  });

  it("manages nothing of a person out of reach: a regular admin on an admin", () => {
    renderPage(undefined, {
      isOwner: false,
      canManage: false,
      person: { role: "admin", ownerBadge: true },
      models: null,
      portfolio: null,
    });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(/alleen de superbeheerder beheert beheerders/i)).toBeInTheDocument();
    expect(screen.getByText(/^superbeheerder$/i)).toBeInTheDocument();
    expect(screen.getByText("t@x.nl")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: /^verwijderen$/i })).toBeNull();
  });

  it("sends an admin to their account page for their own account", () => {
    renderPage(undefined, {
      isSelf: true,
      person: { id: "admin-1", role: "admin" },
      models: null,
      portfolio: null,
    });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("link", { name: /accountpagina/i })).toHaveAttribute(
      "href",
      "/account",
    );
  });

  it("has no a11y violations: owner on a teacher, the dialog open, and read-only", async () => {
    const user = userEvent.setup();
    const owner = renderPage();
    expect((await axe(owner.container, axeOpts)).violations).toEqual([]);
    await user.click(screen.getByRole("button", { name: /wachtwoord instellen/i }));
    expect((await axe(owner.container, axeOpts)).violations).toEqual([]);
    owner.unmount();
    const readOnly = renderPage(undefined, {
      isOwner: false,
      canManage: false,
      person: { role: "admin" },
      models: null,
      portfolio: null,
    });
    expect((await axe(readOnly.container, axeOpts)).violations).toEqual([]);
  });
});
