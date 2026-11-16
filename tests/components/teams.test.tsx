import { describe, it, expect } from "vitest";
import { useState, type ComponentType } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import TeamsOverview from "~/routes/teams._index";
import TeamPage from "~/routes/teams.$id";
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

describe("/teams for an admin: every team (plan step 5)", () => {
  const data = {
    q: "",
    canCreate: true,
    teams: [
      { id: "team-1", name: "Verpleegkunde", memberCount: 2, leads: ["Lea Lead"], isLead: false },
      { id: "team-2", name: "Techniek", memberCount: 0, leads: [], isLead: false },
    ],
  };
  const page = (action?: (args: { request: Request }) => unknown, d: unknown = data) =>
    renderWith(TeamsOverview, "/teams", d, action);

  it("shows one row per team with a link, the member count and who leads", () => {
    page();
    const vpk = screen.getByRole("row", { name: /verpleegkunde/i });
    expect(within(vpk).getByRole("link", { name: "Verpleegkunde" })).toHaveAttribute(
      "href",
      "/teams/team-1",
    );
    expect(within(vpk).getByText("2")).toBeInTheDocument();
    expect(within(vpk).getAllByText("Lea Lead").length).toBeGreaterThan(0);
    const tech = screen.getByRole("row", { name: /techniek/i });
    expect(within(tech).getByText("0")).toBeInTheDocument();
  });

  it("has a search on team or person", () => {
    page(undefined, { ...data, q: "zorg" });
    const search = screen.getByRole("search", { name: /teams zoeken/i });
    expect(within(search).getByLabelText(/zoek op team of persoon/i)).toHaveValue("zorg");
  });

  it("creates a team in the Nieuw team dialog, like every Nieuwe … (plan step 6)", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    page(async ({ request }) => {
      body = await request.formData();
      return { saved: true };
    });
    expect(screen.queryByLabelText(/naam van het nieuwe team/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: /nieuw team/i }));
    const dialog = screen.getByRole("dialog", { name: "Nieuw team" });
    expect(within(dialog).getByLabelText(/naam van het nieuwe team/i)).toHaveFocus();
    await user.keyboard("Zorg");
    await user.click(within(dialog).getByRole("button", { name: /team aanmaken/i }));
    await waitFor(() => expect(body?.get("intent")).toBe("create"));
    expect(body?.get("name")).toBe("Zorg");
  });

  it("says so when there are no teams, and when a search finds none", () => {
    const { unmount } = page(undefined, { q: "", canCreate: true, teams: [] });
    expect(screen.getByText(/nog geen teams/i)).toBeInTheDocument();
    unmount();
    page(undefined, { q: "xyz", canCreate: true, teams: [] });
    expect(screen.getByText(/geen teams gevonden/i)).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = page();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("/teams/:id for an admin", () => {
  const data = {
    role: "admin",
    selfId: "u-admin",
    slideTemplate: null,
    team: {
      id: "team-1",
      name: "Verpleegkunde",
      members,
      settings: { features: { portfolio: "on" }, tools: {}, models: null },
    },
    candidates: [
      { id: "u-a", name: "Anna Aal", email: "anna@school.nl" },
      { id: "u-b", name: "Bram Beuk", email: "bram@school.nl" },
    ],
    offer,
    divisions: [{ id: "d-1", name: "Faculteit Gezondheid" }],
    divisionId: null as string | null,
    belongs: "institution",
    divisionWord: "Faculteit",
    programmes: [{ id: "p-1", name: "Verpleegkunde voltijd" }],
    programmeChoices: [
      { id: "p-2", name: "Pabo", divisionName: "Faculteit Onderwijs" },
      { id: "p-4", name: "Pabo deeltijd", divisionName: null },
    ],
  };
  const page = (action?: (args: { request: Request }) => unknown, d: unknown = data) =>
    renderWith(TeamPage, "/teams/:id", d, action);

  it("shows the team's programmes and adds programmes of other teams in a dialog", async () => {
    const user = userEvent.setup();
    const { bodies, action } = recorder();
    page(action);
    const section = screen.getByRole("region", { name: "Opleidingen" });
    expect(within(section).getByRole("link", { name: "Verpleegkunde voltijd" })).toHaveAttribute(
      "href",
      "/programmes/p-1",
    );
    expect(
      within(section).getByRole("link", { name: /nieuwe opleiding voor dit team/i }),
    ).toHaveAttribute("href", "/programmes?team=team-1");
    await user.click(within(section).getByRole("button", { name: "Opleiding toevoegen" }));
    const dialog = screen.getByRole("dialog", { name: "Opleidingen toevoegen aan Verpleegkunde" });
    await user.click(within(dialog).getByRole("checkbox", { name: /^Pabo Faculteit Onderwijs/ }));
    await user.click(within(dialog).getByRole("checkbox", { name: /Pabo deeltijd/ }));
    await user.click(within(dialog).getByRole("button", { name: "Toevoegen (2)" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!.get("intent")).toBe("linkProgramme");
    expect(bodies[0]!.getAll("programmeId")).toEqual(["p-2", "p-4"]);
  });

  it("asks before taking a programme off the team, and says the programme stays", async () => {
    const user = userEvent.setup();
    const { bodies, action } = recorder();
    page(action);
    await user.click(screen.getByRole("button", { name: "Weghalen: Verpleegkunde voltijd" }));
    const dialog = screen.getByRole("dialog", {
      name: "Verpleegkunde weghalen uit Verpleegkunde voltijd?",
    });
    expect(within(dialog).getByText(/De opleiding blijft bestaan/)).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Weghalen" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!.get("intent")).toBe("unlinkProgramme");
    expect(bodies[0]!.get("programmeId")).toBe("p-1");
  });

  it("says so when the team has no programme and none can be linked", () => {
    page(undefined, { ...data, programmes: [], programmeChoices: [] });
    const section = screen.getByRole("region", { name: "Opleidingen" });
    expect(within(section).getByText(/nog geen opleiding/i)).toBeInTheDocument();
    expect(within(section).queryByRole("button", { name: "Opleiding toevoegen" })).toBeNull();
  });

  it("points to Organisatie when there are no faculties to choose", () => {
    page(undefined, { ...data, divisions: [] });
    const choice = screen.getByRole("group", { name: "Waar hoort dit team bij?" });
    expect(within(choice).getByRole("radio", { name: /een faculteit/i })).toBeDisabled();
    expect(within(choice).getByRole("link", { name: /organisatie/i })).toHaveAttribute(
      "href",
      "/admin/organisation",
    );
  });
  const recorder = () => {
    const bodies: FormData[] = [];
    const action = async ({ request }: { request: Request }) => {
      bodies.push(await request.formData());
      return { saved: true };
    };
    return { bodies, action };
  };

  it("asks where the team belongs as one choice, and saves a faculty at once", async () => {
    const user = userEvent.setup();
    const { bodies, action } = recorder();
    page(action);
    const choice = screen.getByRole("group", { name: "Waar hoort dit team bij?" });
    expect(within(choice).getByRole("radio", { name: /hele instelling/i })).toBeChecked();
    expect(within(choice).queryByLabelText("Faculteit")).toBeNull();
    await user.click(within(choice).getByRole("radio", { name: /een faculteit/i }));
    await waitFor(() => expect(bodies.at(-1)?.get("intent")).toBe("belongs"));
    expect(bodies.at(-1)?.get("belongs")).toBe("division");
    expect(bodies.at(-1)?.get("divisionId")).toBe("d-1");
    expect(within(choice).getByLabelText("Faculteit")).toHaveValue("d-1");
  });

  it("says a team in programmes belongs to them, until they are taken off", () => {
    page(undefined, { ...data, belongs: "programmes" });
    const choice = screen.getByRole("group", { name: "Waar hoort dit team bij?" });
    expect(within(choice).getByRole("radio", { name: /opleidingen/i })).toBeChecked();
    expect(within(choice).getByRole("radio", { name: /een faculteit/i })).toBeDisabled();
    expect(within(choice).getByRole("radio", { name: /hele instelling/i })).toBeDisabled();
    expect(within(choice).getByText(/haal eerst de opleidingen weg/i)).toBeInTheDocument();
  });

  it("follows the saved choice when the page reloads its data, e.g. after linking a programme", async () => {
    // The page keeps its form when its data comes back; the radios must follow the new value.
    let setData: (d: typeof data) => void = () => {};
    const Page = TeamPage as unknown as ComponentType<{ loaderData: typeof data }>;
    function Live() {
      const [d, set] = useState(data);
      setData = set;
      return (
        <ToastProvider>
          <Page loaderData={d} />
        </ToastProvider>
      );
    }
    const Stub = createRoutesStub([{ path: "/teams/:id", Component: Live }]);
    render(<Stub initialEntries={["/teams/team-1"]} />);
    act(() => setData({ ...data, belongs: "programmes" }));
    const choice = await screen.findByRole("group", { name: "Waar hoort dit team bij?" });
    expect(within(choice).getByRole("radio", { name: /opleidingen/i })).toBeChecked();
    expect(within(choice).getByRole("radio", { name: /hele instelling/i })).toBeDisabled();
  });

  it("shows the team under Teams in the breadcrumb, and the delete button", () => {
    page();
    expect(screen.getByRole("heading", { level: 1, name: "Verpleegkunde" })).toBeInTheDocument();
    const crumbs = screen.getByRole("navigation", { name: /kruimelpad|breadcrumb|je bent hier/i });
    expect(within(crumbs).getByRole("link", { name: "Teams" })).toHaveAttribute("href", "/teams");
    expect(screen.getByRole("button", { name: /team opheffen/i })).toBeInTheDocument();
  });

  it("lists the members with who leads, and autosaves the lead stand", async () => {
    const user = userEvent.setup();
    const { bodies, action } = recorder();
    page(action);
    expect(screen.getByRole("checkbox", { name: /teamleider.*lea lead/i })).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: /teamleider.*mo member/i }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!.get("intent")).toBe("setLead");
    expect(bodies[0]!.get("userId")).toBe("u-mem");
    expect(bodies[0]!.get("lead")).toBe("1");
  });

  it("asks before taking a member out of the team", async () => {
    const user = userEvent.setup();
    const { bodies, action } = recorder();
    page(action);
    await user.click(screen.getByRole("button", { name: "Weghalen: Mo Member" }));
    const dialog = screen.getByRole("dialog", { name: "Mo Member weghalen uit Verpleegkunde?" });
    expect(within(dialog).getByText(/Het account blijft bestaan/)).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Weghalen" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!.get("intent")).toBe("removeMember");
    expect(bodies[0]!.get("userId")).toBe("u-mem");
  });

  it("adds several colleagues at once in the Leden toevoegen dialog", async () => {
    const user = userEvent.setup();
    const { bodies, action } = recorder();
    page(action);
    await user.click(screen.getByRole("button", { name: "Leden toevoegen" }));
    const dialog = screen.getByRole("dialog", { name: "Leden toevoegen aan Verpleegkunde" });
    await user.keyboard("bram");
    expect(
      within(dialog).getByRole("checkbox", { name: /anna aal/i, hidden: true }),
    ).not.toBeVisible();
    await user.click(within(dialog).getByRole("checkbox", { name: /bram beuk/i }));
    await user.click(within(dialog).getByRole("button", { name: "Toevoegen (1)" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!.get("intent")).toBe("addMembers");
    expect(bodies[0]!.getAll("userIds")).toEqual(["u-b"]);
  });

  it("says so when everyone is already in the team", async () => {
    const user = userEvent.setup();
    page(undefined, { ...data, candidates: [] });
    await user.click(screen.getByRole("button", { name: "Leden toevoegen" }));
    expect(screen.getByText(/iedereen zit al in dit team/i)).toBeInTheDocument();
  });

  it("autosaves the name", async () => {
    const user = userEvent.setup();
    const { bodies, action } = recorder();
    page(action);
    const name = screen.getByLabelText(/naam van het team/i);
    await user.clear(name);
    await user.type(name, "VPK");
    await user.tab();
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!.get("intent")).toBe("rename");
    expect(bodies[0]!.get("name")).toBe("VPK");
  });

  it("shows the team's choices and autosaves one (P28.3)", async () => {
    const user = userEvent.setup();
    const { bodies, action } = recorder();
    page(action);
    expect(screen.getByRole("combobox", { name: /bdb\/bke.*keuze van het team/i })).toHaveValue(
      "on",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /hulpmiddelen.*keuze van het team/i }),
      "off",
    );
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!.get("intent")).toBe("settings");
    expect(bodies[0]!.get("feature:utilities")).toBe("off");
    expect(bodies[0]!.get("feature:portfolio")).toBe("on");
  });

  it("deletes the team only after a confirmation", async () => {
    const user = userEvent.setup();
    const { bodies, action } = recorder();
    page(action);
    await user.click(screen.getByRole("button", { name: /team opheffen/i }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/gedeelde stukken worden weer privé/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /opheffen/i }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!.get("intent")).toBe("delete");
  });

  it("has no a11y violations", async () => {
    const { container } = page();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("/teams/:id — the lead's page (P28.2)", () => {
  const data = {
    role: "lead",
    selfId: "u-lead",
    divisions: [],
    divisionId: null,
    divisionWord: "Faculteit",
    slideTemplate: null,
    team: { id: "team-1", name: "Verpleegkunde", members, settings: noChoices },
    offer,
    programmes: [{ id: "p-1", name: "Verpleegkunde voltijd" }],
    programmeChoices: [{ id: "p-2", name: "Pabo", divisionName: "Faculteit Onderwijs" }],
    candidates: [
      { id: "u-a", name: "Anna Aal", email: "anna@school.nl" },
      { id: "u-b", name: "Bram Beuk", email: "bram@school.nl" },
    ],
  };
  const page = (action?: (args: { request: Request }) => unknown, d: unknown = data) =>
    renderWith(TeamPage, "/teams/:id", d, action);

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
    expect(within(mo).getByRole("button", { name: "Weghalen: Mo Member" })).toBeInTheDocument();
    const lea = screen.getByRole("row", { name: /lea lead/i });
    expect(within(lea).queryByRole("button")).toBeNull();
  });

  it("lets the lead choose colleagues to add, with search and ticks (Bastiaan, 16-11)", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    page(async ({ request }) => {
      body = await request.formData();
      return { saved: true };
    });
    await user.click(screen.getByRole("button", { name: "Leden toevoegen" }));
    const dialog = screen.getByRole("dialog", { name: "Leden toevoegen aan Verpleegkunde" });
    await user.keyboard("bram");
    expect(
      within(dialog).getByRole("checkbox", { name: /anna aal/i, hidden: true }),
    ).not.toBeVisible();
    await user.click(within(dialog).getByRole("checkbox", { name: /bram beuk/i }));
    await user.click(within(dialog).getByRole("button", { name: "Toevoegen (1)" }));
    await waitFor(() => expect(body?.get("intent")).toBe("addMembers"));
    expect(body?.getAll("userIds")).toEqual(["u-b"]);
  });

  it("says so when every colleague is already in the team", async () => {
    const user = userEvent.setup();
    page(undefined, { ...data, candidates: [] });
    await user.click(screen.getByRole("button", { name: "Leden toevoegen" }));
    expect(screen.getByText(/iedereen zit al in dit team/i)).toBeInTheDocument();
  });

  it("asks before taking a member out", async () => {
    const user = userEvent.setup();
    let body: FormData | undefined;
    page(async ({ request }) => {
      body = await request.formData();
      return { saved: true };
    });
    await user.click(screen.getByRole("button", { name: "Weghalen: Mo Member" }));
    const dialog = screen.getByRole("dialog", { name: "Mo Member weghalen uit Verpleegkunde?" });
    await user.click(within(dialog).getByRole("button", { name: "Weghalen" }));
    await waitFor(() => expect(body?.get("intent")).toBe("removeMember"));
  });

  it("shows a refusal as an error toast", async () => {
    const user = userEvent.setup();
    page(() => ({ error: "noSuchUser" }));
    await user.click(screen.getByRole("button", { name: "Leden toevoegen" }));
    await user.click(screen.getByRole("checkbox", { name: /anna aal/i }));
    await user.click(screen.getByRole("button", { name: "Toevoegen (1)" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/kun je niet toevoegen/i),
    );
  });

  it("lets the lead add the team to programmes, and take it off after a confirm", async () => {
    const user = userEvent.setup();
    const bodies: FormData[] = [];
    page(async ({ request }) => {
      bodies.push(await request.formData());
      return { saved: true };
    });
    const section = screen.getByRole("region", { name: "Opleidingen" });
    // Only an admin creates a programme (BESLUIT-2026-11-16-4).
    expect(within(section).queryByRole("link", { name: /nieuwe opleiding/i })).toBeNull();
    expect(within(section).getByRole("link", { name: "Verpleegkunde voltijd" })).toHaveAttribute(
      "href",
      "/programmes/p-1",
    );
    await user.click(within(section).getByRole("button", { name: "Opleiding toevoegen" }));
    const dialog = screen.getByRole("dialog", { name: "Opleidingen toevoegen aan Verpleegkunde" });
    await user.click(within(dialog).getByRole("checkbox", { name: /Pabo/ }));
    await user.click(within(dialog).getByRole("button", { name: "Toevoegen (1)" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!.get("intent")).toBe("linkProgramme");
    expect(bodies[0]!.getAll("programmeId")).toEqual(["p-2"]);
    await user.click(screen.getByRole("button", { name: "Weghalen: Verpleegkunde voltijd" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Weghalen" }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]!.get("intent")).toBe("unlinkProgramme");
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
    expect(bodies[0]!.get("tool:math-grading")).toBe("on");

    const models = within(box).getByRole("group", { name: /modellen voor dit team/i });
    const haiku = within(models).getByLabelText("Claude Haiku 4.5") as HTMLInputElement;
    expect(haiku.disabled).toBe(true);
    await user.click(within(models).getByRole("radio", { name: /eigen keuze/i }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]!.get("modelMode")).toBe("own");
    expect(bodies[1]!.getAll("models")).toEqual(["claude-sonnet-4-6", "claude-haiku-4-5"]);
    expect(bodies[1]!.get("feature:portfolio")).toBeNull();
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

describe("/teams/:id help", () => {
  it("links the lead to the help on teams and sharing", () => {
    renderWith(TeamPage, "/teams/:id", {
      role: "lead",
      selfId: "u-lead",
      programmes: [],
      programmeChoices: [],
      slideTemplate: null,
      team: { id: "team-1", name: "Verpleegkunde", members, settings: noChoices },
      offer,
      candidates: [],
    });
    expect(screen.getByRole("link", { name: "Hoe werkt dit?" })).toHaveAttribute(
      "href",
      "/help/teams",
    );
  });
});

describe("/teams for a teacher: my teams (plan step 5)", () => {
  const data = {
    q: "",
    canCreate: false,
    teams: [
      { id: "team-1", name: "Verpleegkunde", memberCount: 2, leads: ["Lea Lead"], isLead: true },
      { id: "team-2", name: "Toetscommissie", memberCount: 5, leads: [], isLead: false },
    ],
  };
  const page = (d: unknown = data) => renderWith(TeamsOverview, "/teams", d);

  it("lists the teams I am in, each opening its page, with my lead badge", () => {
    page();
    expect(screen.getByRole("heading", { level: 1, name: "Teams" })).toBeInTheDocument();
    const vpk = screen.getByRole("row", { name: /verpleegkunde/i });
    expect(within(vpk).getByRole("link", { name: "Verpleegkunde" })).toHaveAttribute(
      "href",
      "/teams/team-1",
    );
    expect(within(vpk).getByText(/^teamleider$/i)).toBeInTheDocument();
    const toets = screen.getByRole("row", { name: /toetscommissie/i });
    expect(within(toets).queryByText(/^teamleider$/i)).toBeNull();
  });

  it("has no Nieuw team, and says so when I am in no team", () => {
    page({ q: "", canCreate: false, teams: [] });
    expect(screen.queryByRole("button", { name: /nieuw team/i })).toBeNull();
    expect(screen.getByText(/je zit nog in geen team/i)).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = page();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("/teams/:id for a plain member: read only (BESLUIT-2026-11-16-7)", () => {
  const data = {
    role: "member",
    selfId: "u-mem",
    team: {
      id: "team-1",
      name: "Verpleegkunde",
      members: members.map(({ userId, name, isLead }) => ({ userId, name, isLead })),
    },
    candidates: [],
    offer: null,
    programmes: [{ id: "p-1", name: "Verpleegkunde voltijd" }],
    programmeChoices: [],
    divisions: [],
    divisionId: null,
    divisionWord: "Faculteit",
    slideTemplate: null,
  };
  const page = () => renderWith(TeamPage, "/teams/:id", data);

  it("shows who is in the team, who leads and its programmes, with nothing to press", () => {
    page();
    expect(screen.getByText(/je bent lid van dit team/i)).toBeInTheDocument();
    const lea = screen.getByRole("row", { name: /lea lead/i });
    expect(within(lea).getByText(/^teamleider$/i)).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /mo member/i })).toHaveTextContent(/jij/i);
    expect(screen.queryByText("mo@school.nl")).toBeNull();
    const progs = screen.getByRole("region", { name: "Opleidingen" });
    expect(within(progs).getByRole("link", { name: "Verpleegkunde voltijd" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("has no a11y violations", async () => {
    const { container } = page();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
