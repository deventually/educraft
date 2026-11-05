import { describe, it, expect } from "vitest";
import type { ComponentType } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminTeams from "~/routes/admin.teams";
import LeadTeam from "~/routes/teams.$id";
import { ToastProvider } from "~/components/Toast";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const offer = {
  features: [
    { id: "portfolio", name: { nl: "BDB/BKE-werkplaats", en: "BDB/BKE workplace" } },
    { id: "utilities", name: { nl: "Hulpmiddelen", en: "Utilities" } },
  ],
  tools: [{ slug: "math-grading", name: { nl: "Wiskunde nakijken", en: "Math grading" } }],
  models: [
    { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6" },
    { id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5" },
  ],
};
const noChoices = { features: {}, tools: {}, models: null };

const members = [
  { userId: "u-lead", name: "Lea Lead", email: "lea@school.nl", isLead: true },
  { userId: "u-mem", name: "Mo Member", email: "mo@school.nl", isLead: false },
];

function renderWith(
  // biome-ignore lint/suspicious/noExplicitAny: a route component of either page
  Page: ComponentType<any>,
  path: string,
  loaderData: unknown,
  action?: (args: { request: Request }) => unknown,
) {
  const props = { loaderData };
  const Stub = createRoutesStub([
    {
      path,
      Component: () => (
        <ToastProvider>
          <Page {...props} />
        </ToastProvider>
      ),
      action: action ?? (() => ({ saved: true })),
    },
  ]);
  return render(<Stub initialEntries={[path.replace(":id", "team-1")]} />);
}

describe("/admin/teams (P28.2)", () => {
  const data = {
    teams: [
      {
        id: "team-1",
        name: "Verpleegkunde",
        members,
        settings: { features: { portfolio: "on" }, tools: {}, models: null },
      },
      { id: "team-2", name: "Techniek", members: [], settings: noChoices },
    ],
    offer,
  };
  const page = (action?: (args: { request: Request }) => unknown, d: unknown = data) =>
    renderWith(AdminTeams, "/admin/teams", d, action);
  const card = (name: string) =>
    screen.getByRole("heading", { level: 3, name }).closest("article") as HTMLElement;

  it("lists each team with its members and who leads", () => {
    page();
    const vpk = card("Verpleegkunde");
    expect(within(vpk).getByText("Lea Lead")).toBeInTheDocument();
    expect(within(vpk).getByText("mo@school.nl")).toBeInTheDocument();
    expect(within(vpk).getByRole("checkbox", { name: /teamleider.*lea lead/i })).toBeChecked();
    expect(within(vpk).getByRole("checkbox", { name: /teamleider.*mo member/i })).not.toBeChecked();
    expect(within(card("Techniek")).getByText(/nog geen leden/i)).toBeInTheDocument();
  });

  it("creates a team", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    page(async ({ request }) => {
      body = await request.formData();
      return { saved: true };
    });
    await user.type(screen.getByLabelText(/naam van het nieuwe team/i), "Zorg");
    await user.click(screen.getByRole("button", { name: /team aanmaken/i }));
    await waitFor(() => expect(body?.get("intent")).toBe("create"));
    expect(body?.get("name")).toBe("Zorg");
  });

  it("autosaves the lead stand of a member", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    page(async ({ request }) => {
      body = await request.formData();
      return { saved: true };
    });
    await user.click(
      within(card("Verpleegkunde")).getByRole("checkbox", { name: /teamleider.*mo member/i }),
    );
    await waitFor(() => expect(body?.get("intent")).toBe("setLead"));
    expect(body?.get("teamId")).toBe("team-1");
    expect(body?.get("userId")).toBe("u-mem");
    expect(body?.get("lead")).toBe("1");
  });

  it("adds a member by e-mail and removes one", async () => {
    const user = userEvent.setup();
    const bodies: FormData[] = [];
    page(async ({ request }) => {
      bodies.push(await request.formData());
      return { saved: true };
    });
    const vpk = card("Verpleegkunde");
    await user.type(within(vpk).getByLabelText(/lid toevoegen op e-mail/i), "new@school.nl");
    await user.click(within(vpk).getByRole("button", { name: /^toevoegen$/i }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0].get("intent")).toBe("addMember");
    expect(bodies[0].get("email")).toBe("new@school.nl");
    await user.click(within(vpk).getByRole("button", { name: /mo member uit het team halen/i }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1].get("intent")).toBe("removeMember");
    expect(bodies[1].get("userId")).toBe("u-mem");
  });

  it("deletes a team only after a confirmation", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    page(async ({ request }) => {
      body = await request.formData();
      return { saved: true };
    });
    await user.click(within(card("Techniek")).getByRole("button", { name: /team opheffen/i }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/gedeelde stukken worden weer privé/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /opheffen/i }));
    await waitFor(() => expect(body?.get("intent")).toBe("delete"));
    expect(body?.get("teamId")).toBe("team-2");
  });

  it("shows a team's choices and autosaves one, with the team (P28.3)", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    page(async ({ request }) => {
      body = await request.formData();
      return { saved: true };
    });
    const vpk = card("Verpleegkunde");
    const bdb = within(vpk).getByRole("combobox", { name: /bdb\/bke.*keuze van het team/i });
    expect(bdb).toHaveValue("on");
    await user.selectOptions(
      within(vpk).getByRole("combobox", { name: /hulpmiddelen.*keuze van het team/i }),
      "off",
    );
    await waitFor(() => expect(body?.get("intent")).toBe("settings"));
    expect(body?.get("teamId")).toBe("team-1");
    expect(body?.get("feature:utilities")).toBe("off");
    expect(body?.get("feature:portfolio")).toBe("on");
    expect(body?.get("modelMode")).toBeNull();
  });

  it("says so when there are no teams", () => {
    page(undefined, { teams: [], offer });
    expect(screen.getByText(/nog geen teams/i)).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = page();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("/teams/:id — the lead's page (P28.2)", () => {
  const data = {
    selfId: "u-lead",
    team: { id: "team-1", name: "Verpleegkunde", members, settings: noChoices },
    offer,
  };
  const page = (action?: (args: { request: Request }) => unknown) =>
    renderWith(LeadTeam, "/teams/:id", data, action);

  it("shows the members with name, e-mail and lead badge", () => {
    page();
    expect(screen.getByRole("heading", { level: 1, name: /verpleegkunde/i })).toBeInTheDocument();
    const mo = screen.getByRole("row", { name: /mo member/i });
    expect(within(mo).getAllByText("mo@school.nl").length).toBeGreaterThan(0);
    const lea = screen.getByRole("row", { name: /lea lead/i });
    expect(within(lea).getByText(/^teamleider$/i)).toBeInTheDocument();
  });

  it("offers make-lead and remove on a plain member only, never on a lead", () => {
    page();
    const mo = screen.getByRole("row", { name: /mo member/i });
    expect(within(mo).getByRole("button", { name: /teamleider maken/i })).toBeInTheDocument();
    expect(within(mo).getByRole("button", { name: /uit het team halen/i })).toBeInTheDocument();
    const lea = screen.getByRole("row", { name: /lea lead/i });
    expect(within(lea).queryByRole("button")).toBeNull();
  });

  it("adds a colleague by exact e-mail", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    page(async ({ request }) => {
      body = await request.formData();
      return { saved: true };
    });
    expect(screen.getByText(/precies het e-mailadres/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/e-mailadres van je collega/i), "c@school.nl");
    await user.click(screen.getByRole("button", { name: /^toevoegen$/i }));
    await waitFor(() => expect(body?.get("intent")).toBe("addMember"));
    expect(body?.get("email")).toBe("c@school.nl");
  });

  it("shows a refusal as an error toast", async () => {
    const user = userEvent.setup();
    page(() => ({ error: "noSuchUser" }));
    await user.type(screen.getByLabelText(/e-mailadres van je collega/i), "x@school.nl");
    await user.click(screen.getByRole("button", { name: /^toevoegen$/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/geen account met dit e-mailadres/i),
    );
  });

  it("mints an invite link for the team and shows it", async () => {
    const user = userEvent.setup();
    page(() => ({ link: "http://localhost/invite/tok-team" }));
    await user.click(screen.getByRole("button", { name: /uitnodigingslink maken/i }));
    expect(await screen.findByText("http://localhost/invite/tok-team")).toBeInTheDocument();
  });

  it("lets the lead choose parts, tools and models for the team (P28.3)", async () => {
    const user = userEvent.setup();
    const bodies: FormData[] = [];
    page(async ({ request }) => {
      bodies.push(await request.formData());
      return { saved: true };
    });
    const box = screen.getByRole("region", { name: /onderdelen en tools/i });
    const tool = within(box).getByRole("combobox", { name: /wiskunde nakijken/i });
    expect(tool).toHaveValue("");
    await user.selectOptions(tool, "on");
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0].get("tool:math-grading")).toBe("on");

    const models = within(box).getByRole("group", { name: /modellen voor dit team/i });
    const haiku = within(models).getByLabelText("Claude Haiku 4.5") as HTMLInputElement;
    expect(haiku.disabled).toBe(true);
    await user.click(within(models).getByRole("radio", { name: /eigen keuze/i }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1].get("modelMode")).toBe("own");
    expect(bodies[1].getAll("models")).toEqual(["claude-sonnet-4-6", "claude-haiku-4-5"]);
    expect(bodies[1].get("feature:portfolio")).toBeNull();
  });

  it("lets the lead step down after a confirmation", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    page(async ({ request }) => {
      body = await request.formData();
      return null;
    });
    await user.click(screen.getByRole("button", { name: /stoppen als teamleider/i }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /stoppen als teamleider/i }),
    );
    await waitFor(() => expect(body?.get("intent")).toBe("stepDown"));
  });

  it("has no a11y violations", async () => {
    const { container } = page();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
