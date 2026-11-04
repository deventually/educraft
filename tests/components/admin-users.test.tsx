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
    },
    // An inheriting teacher's boxes show the instance set (here: Sonnet only).
    {
      id: "t2",
      name: "Teacher Two",
      email: null,
      mode: "inherit",
      models: ["claude-sonnet-4-6"],
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
) {
  const props = {
    loaderData: { ...loaderData, users: [...loaderData.users, ...extraUsers] },
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
    // The admin's own row shows no role <select>; only the teacher's does.
    const selects = screen.getAllByRole("combobox");
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

  it("has no a11y violations", async () => {
    const { container } = renderRoute();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
