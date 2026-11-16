import { describe, expect, it } from "vitest";
import type { ComponentType } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import ProgrammeList from "~/routes/programmes._index";
import ProgrammePage from "~/routes/programmes.$id";
import { CourseProgrammes } from "~/components/programmes/CourseProgrammes";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

// biome-ignore lint/suspicious/noExplicitAny: route components take framework-typed props
function renderRoute(Component: ComponentType<any>, loaderData: unknown) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <Component loaderData={loaderData} /> },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

function renderInRouter(node: React.ReactNode) {
  const Stub = createRoutesStub([{ path: "/", Component: () => node }]);
  return render(<Stub initialEntries={["/"]} />);
}

const kinds = [
  { value: "hbo:bachelor", label: "hbo-bachelor" },
  { value: "hbo:master", label: "hbo-master" },
];

describe("Programme list (/programmes)", () => {
  const teams = [{ id: "t1", name: "Informatica" }];

  it("offers a team lead Nieuwe opleiding, with team, level and mode, and a guided empty state", async () => {
    const user = userEvent.setup();
    const { container } = renderRoute(ProgrammeList, { programmes: [], kinds, teams });
    expect(screen.getByRole("heading", { level: 1, name: "Opleidingen" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Nog geen opleidingen" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Hoe werken opleidingen?" })).toHaveAttribute(
      "href",
      "/help/programmes",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    await user.click(screen.getAllByRole("button", { name: "Nieuwe opleiding" })[0]!);
    const dialog = screen.getByRole("dialog", { name: "Nieuwe opleiding" });
    expect(within(dialog).getByLabelText("Team")).toHaveDisplayValue("Informatica");
    expect(within(dialog).getByLabelText("Naam")).toBeRequired();
    expect(within(dialog).getByLabelText("Onderwijstype en niveau")).toHaveDisplayValue(
      "hbo-bachelor",
    );
    expect(within(dialog).getByLabelText("Vorm")).toHaveDisplayValue("Niet ingevuld");
    // A lead does not choose the faculty: that is the admin's.
    expect(within(dialog).queryByLabelText("Faculteit")).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Opleiding aanmaken" })).toBeVisible();
  });

  it("lets an admin start one without a team, under a faculty", async () => {
    const user = userEvent.setup();
    renderRoute(ProgrammeList, {
      programmes: [],
      kinds,
      teams,
      isAdmin: true,
      divisionWord: "Faculteit",
      divisions: [{ id: "d1", name: "Faculteit Techniek" }],
    });
    await user.click(screen.getAllByRole("button", { name: "Nieuwe opleiding" })[0]!);
    const dialog = screen.getByRole("dialog", { name: "Nieuwe opleiding" });
    expect(within(dialog).getByLabelText("Team")).toHaveDisplayValue("Nog geen team");
    expect(within(dialog).getByLabelText("Faculteit")).toHaveDisplayValue("Geen");
    await user.selectOptions(within(dialog).getByLabelText("Faculteit"), "d1");
  });

  it("tells a teacher who leads no team who creates a programme", () => {
    renderRoute(ProgrammeList, { programmes: [], kinds, teams: [] });
    expect(screen.queryByRole("button", { name: "Nieuwe opleiding" })).toBeNull();
    expect(
      screen.getByText(/Alleen een teamleider of een beheerder maakt er een aan/),
    ).toBeVisible();
  });

  it("lists programmes with kind, team and number of courses; delete only for an admin", async () => {
    const { container } = renderRoute(ProgrammeList, {
      programmes: [
        {
          id: "p1",
          name: "HBO-ICT",
          kind: "hbo-bachelor · voltijd",
          teamName: "Informatica",
          courses: 12,
          canDelete: true,
        },
        {
          id: "p2",
          name: "Minor Data",
          kind: "hbo-bachelor",
          teamName: "Data",
          courses: 3,
          canDelete: false,
        },
      ],
      kinds,
      teams,
    });
    expect(screen.getByRole("link", { name: "HBO-ICT" })).toHaveAttribute("href", "/programmes/p1");
    expect(
      screen.getByText("hbo-bachelor · voltijd · team Informatica · 12 cursussen"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Verwijderen: HBO-ICT" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Verwijderen: Minor Data" })).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("Programme page (/programmes/:id)", () => {
  const data = {
    programme: {
      id: "p1",
      name: "HBO-ICT",
      kind: "hbo:bachelor",
      form: "fulltime",
      kindLabel: "hbo-bachelor · voltijd",
      teamName: "Informatica",
      teamCount: 1,
      teams: [{ id: "t1", name: "Informatica" }],
      canManage: false,
      courses: [
        {
          courseId: "c1",
          name: "Programmeren 1",
          ownerName: "Ik",
          year: 1,
          period: 2,
          mine: true,
        },
        {
          courseId: "c2",
          name: "Afstuderen",
          ownerName: "Sanne",
          year: null,
          period: null,
          mine: false,
        },
      ],
    },
    kinds,
    available: [{ id: "c3", name: "Databases" }],
    teamOptions: [] as { id: string; label: string; hint?: string }[],
    myTeamIds: [] as string[],
    canPlace: true,
  };

  it("shows the courses with their place, Cursus toevoegen and Weghalen", async () => {
    const { container } = renderRoute(ProgrammePage, data);
    expect(screen.getByRole("heading", { level: 1, name: "HBO-ICT" })).toBeVisible();
    const courses = screen.getByRole("region", { name: "Cursussen" });
    expect(within(courses).getByText(/Jaar 1 · periode 2/)).toBeVisible();
    expect(within(courses).getByText(/Nog geen jaar of periode/)).toBeVisible();
    expect(screen.getByLabelText("Jaar (Programmeren 1)")).toHaveValue(1);
    expect(within(courses).getByRole("button", { name: "Cursus toevoegen" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Weghalen: Programmeren 1" })).toBeVisible();
    // A colleague's course: who owns it, read-only, no move or remove for a member.
    expect(screen.getByRole("link", { name: "Afstuderen" })).toHaveAttribute(
      "href",
      "/courses/shared/c2",
    );
    expect(screen.getByText(/Van Sanne/)).toBeVisible();
    expect(screen.queryByLabelText("Jaar (Afstuderen)")).toBeNull();
    expect(screen.queryByRole("button", { name: "Weghalen: Afstuderen" })).toBeNull();
    expect(screen.getByText("hbo-bachelor · voltijd · Team Informatica")).toBeVisible();
    // Only the lead or an admin edits the details.
    expect(screen.queryByLabelText("Vorm")).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("adds courses in a dialog: tick several, with one year and period", async () => {
    const user = userEvent.setup();
    renderRoute(ProgrammePage, data);
    await user.click(screen.getByRole("button", { name: "Cursus toevoegen" }));
    const dialog = screen.getByRole("dialog", { name: "Cursussen toevoegen aan HBO-ICT" });
    expect(within(dialog).getByRole("checkbox", { name: "Databases" })).toBeVisible();
    expect(within(dialog).getByLabelText("Jaar")).toBeVisible();
    expect(within(dialog).getByText(/zien de collega's van Informatica hem/)).toBeVisible();
  });

  it("asks before taking a course out, and says the course stays", async () => {
    const user = userEvent.setup();
    renderRoute(ProgrammePage, data);
    await user.click(screen.getByRole("button", { name: "Weghalen: Programmeren 1" }));
    const dialog = screen.getByRole("dialog", { name: "Programmeren 1 weghalen uit HBO-ICT?" });
    expect(within(dialog).getByText(/De cursus blijft bestaan/)).toBeVisible();
  });

  it("lets the lead edit the details and take out a colleague's course", () => {
    renderRoute(ProgrammePage, { ...data, programme: { ...data.programme, canManage: true } });
    expect(screen.getByLabelText("Vorm")).toHaveDisplayValue("voltijd");
    expect(screen.getByRole("button", { name: "Weghalen: Afstuderen" })).toBeVisible();
  });

  it("shows its teams; Weghalen on the teams you speak for, Team toevoegen with what you may add", async () => {
    const user = userEvent.setup();
    const lead = {
      ...data,
      programme: {
        ...data.programme,
        canManage: true,
        teams: [
          { id: "t1", name: "Informatica" },
          { id: "t2", name: "Moduleteam Web" },
        ],
      },
      teamOptions: [{ id: "t3", label: "Moduleteam Data", hint: "4 leden" }],
      myTeamIds: ["t2"],
    };
    const { container } = renderRoute(ProgrammePage, lead);
    const teams = screen.getByRole("region", { name: "Teams" });
    expect(within(teams).getAllByRole("listitem")).toHaveLength(2);
    expect(within(teams).queryByRole("button", { name: "Weghalen: Informatica" })).toBeNull();
    await user.click(within(teams).getByRole("button", { name: "Weghalen: Moduleteam Web" }));
    expect(
      screen.getByRole("dialog", { name: "Moduleteam Web weghalen uit HBO-ICT?" }),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    await user.click(within(teams).getByRole("button", { name: "Team toevoegen" }));
    const dialog = screen.getByRole("dialog", { name: "Teams toevoegen aan HBO-ICT" });
    expect(within(dialog).getByRole("checkbox", { name: /Moduleteam Data/ })).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("always offers an admin Team toevoegen, and says where to make a team when there is none", async () => {
    const user = userEvent.setup();
    renderRoute(ProgrammePage, { ...data, isAdmin: true, teamOptions: [] });
    await user.click(screen.getByRole("button", { name: "Team toevoegen" }));
    expect(screen.getByText(/Een nieuw team maak je bij Beheer → Teams/)).toBeVisible();
  });

  it("says so when the programme has no team yet", () => {
    renderRoute(ProgrammePage, {
      ...data,
      programme: { ...data.programme, teams: [], teamCount: 0, teamName: "" },
    });
    expect(screen.getByText("hbo-bachelor · voltijd · nog geen team")).toBeVisible();
    expect(
      screen.getByText(/Nog geen team. Alleen een beheerder ziet deze opleiding/),
    ).toBeVisible();
  });

  it("shows a member the teams, without buttons", () => {
    renderRoute(ProgrammePage, data);
    const teams = screen.getByRole("region", { name: "Teams" });
    expect(within(teams).getByText("Informatica")).toBeVisible();
    expect(within(teams).queryByRole("button")).toBeNull();
  });

  it("has Verwijderen at the bottom for an admin, after a confirm", async () => {
    const user = userEvent.setup();
    renderRoute(ProgrammePage, { ...data, canDelete: true });
    await user.click(screen.getByRole("button", { name: "Opleiding verwijderen" }));
    const dialog = screen.getByRole("dialog", { name: "Opleiding verwijderen?" });
    expect(within(dialog).getByText(/Je cursussen blijven gewoon bestaan/)).toBeVisible();
  });

  it("has no Verwijderen for anyone else", () => {
    renderRoute(ProgrammePage, data);
    expect(screen.queryByRole("button", { name: "Opleiding verwijderen" })).toBeNull();
  });

  it("names every team of a programme with several (BESLUIT-2026-11-16-1)", () => {
    renderRoute(ProgrammePage, {
      ...data,
      programme: { ...data.programme, teamName: "Informatica, Moduleteam Web", teamCount: 2 },
    });
    expect(
      screen.getByText("hbo-bachelor · voltijd · Teams Informatica, Moduleteam Web"),
    ).toBeVisible();
  });

  it("tells a reader outside its teams (an admin) why they cannot add a course", () => {
    renderRoute(ProgrammePage, { ...data, canPlace: false });
    expect(screen.queryByRole("button", { name: "Cursus toevoegen" })).toBeNull();
    expect(screen.getByText(/Je zit niet in een team van deze opleiding/)).toBeVisible();
  });

  it("says so in the dialog when every course is already in it", async () => {
    const user = userEvent.setup();
    renderRoute(ProgrammePage, { ...data, available: [] });
    await user.click(screen.getByRole("button", { name: "Cursus toevoegen" }));
    expect(screen.getByText("Al je cursussen zitten in deze opleiding.")).toBeVisible();
  });
});

describe("Course page: belongs to programme", () => {
  it("lists the programmes with year and period and offers to add one", async () => {
    const { container } = renderInRouter(
      <CourseProgrammes
        placed={[
          { programmeId: "p1", name: "Deeltijd", teamName: "Informatica", year: 2, period: 3 },
        ]}
        options={[{ id: "p1", name: "Deeltijd", teamName: "Informatica" }]}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Hoort bij opleiding" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Deeltijd" })).toHaveAttribute(
      "href",
      "/programmes/p1",
    );
    expect(screen.getByText("Team Informatica · Jaar 2 · periode 3")).toBeVisible();
    expect(screen.getByLabelText("Opleiding")).toHaveDisplayValue("Deeltijd (team Informatica)");
    expect(
      screen.getByText("Je cursus wordt gedeeld met het team van de opleiding die je kiest."),
    ).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows where the course sits in its learning lines, with the course before and after", async () => {
    const { container } = renderInRouter(
      <CourseProgrammes
        placed={[]}
        options={[]}
        lines={[
          {
            lineId: "l1",
            name: "Onderzoek",
            programmeId: "p1",
            position: 2,
            total: 3,
            previous: { id: "c0", name: "Onderzoek 1" },
            next: { id: "c2", name: "Onderzoek 3" },
          },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Leerlijnen" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Onderzoek" })).toHaveAttribute(
      "href",
      "/programmes/p1/lines/l1",
    );
    expect(screen.getByText("cursus 2 van 3")).toBeVisible();
    expect(screen.getByRole("link", { name: "Vorige: Onderzoek 1" })).toHaveAttribute(
      "href",
      "/courses/c0",
    );
    expect(screen.getByRole("link", { name: "Volgende: Onderzoek 3" })).toHaveAttribute(
      "href",
      "/courses/c2",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("points to the programmes page when there are none yet", () => {
    renderInRouter(<CourseProgrammes placed={[]} options={[]} />);
    expect(screen.getByText("Deze cursus hoort nog bij geen opleiding.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Maak een opleiding aan" })).toHaveAttribute(
      "href",
      "/programmes",
    );
  });
});
