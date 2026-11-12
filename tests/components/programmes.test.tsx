import { describe, expect, it } from "vitest";
import type { ComponentType } from "react";
import { render, screen } from "@testing-library/react";
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

  it("offers a team lead a create form with team, level and mode, and a guided empty state", async () => {
    const { container } = renderRoute(ProgrammeList, { programmes: [], kinds, teams });
    expect(screen.getByLabelText("Team")).toHaveDisplayValue("Informatica");
    expect(screen.getByRole("heading", { level: 1, name: "Opleidingen" })).toBeVisible();
    expect(screen.getByLabelText("Naam")).toBeRequired();
    expect(screen.getByLabelText("Onderwijstype en niveau")).toHaveDisplayValue("hbo-bachelor");
    expect(screen.getByLabelText("Vorm")).toHaveDisplayValue("Niet ingevuld");
    expect(screen.getByRole("heading", { level: 2, name: "Nog geen opleidingen" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Hoe werken opleidingen?" })).toHaveAttribute(
      "href",
      "/help/programmes",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("tells a teacher who leads no team who creates a programme", () => {
    renderRoute(ProgrammeList, { programmes: [], kinds, teams: [] });
    expect(screen.queryByRole("button", { name: "Opleiding aanmaken" })).toBeNull();
    expect(
      screen.getByText(/Alleen een teamleider of een beheerder maakt er een aan/),
    ).toBeVisible();
  });

  it("lists programmes with kind, team and number of courses; delete only where you manage", async () => {
    const { container } = renderRoute(ProgrammeList, {
      programmes: [
        {
          id: "p1",
          name: "HBO-ICT",
          kind: "hbo-bachelor · voltijd",
          teamName: "Informatica",
          courses: 12,
          canManage: true,
        },
        {
          id: "p2",
          name: "Minor Data",
          kind: "hbo-bachelor",
          teamName: "Data",
          courses: 3,
          canManage: false,
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
  };

  it("shows the courses with their place, and forms to move, remove and add", async () => {
    const { container } = renderRoute(ProgrammePage, data);
    expect(screen.getByRole("heading", { level: 1, name: "HBO-ICT" })).toBeVisible();
    expect(screen.getByText("Jaar 1 · periode 2")).toBeVisible();
    expect(screen.getByText("Nog geen jaar of periode")).toBeVisible();
    expect(screen.getByLabelText("Jaar (Programmeren 1)")).toHaveValue(1);
    expect(screen.getByRole("button", { name: "Weghalen (Programmeren 1)" })).toBeVisible();
    // A colleague's course: who owns it, read-only, no move or remove for a member.
    expect(screen.getByRole("link", { name: "Afstuderen" })).toHaveAttribute(
      "href",
      "/courses/shared/c2",
    );
    expect(screen.getByText("Van Sanne")).toBeVisible();
    expect(screen.queryByLabelText("Jaar (Afstuderen)")).toBeNull();
    expect(screen.queryByRole("button", { name: "Weghalen (Afstuderen)" })).toBeNull();
    expect(screen.getByLabelText("Cursus")).toHaveDisplayValue("Databases");
    expect(screen.getByText(/gedeeld met het team Informatica/)).toBeVisible();
    // Only the lead or an admin edits the details.
    expect(screen.queryByLabelText("Vorm")).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("lets the lead edit the details and take out a colleague's course", () => {
    renderRoute(ProgrammePage, { ...data, programme: { ...data.programme, canManage: true } });
    expect(screen.getByLabelText("Vorm")).toHaveDisplayValue("voltijd");
    expect(screen.getByRole("button", { name: "Weghalen (Afstuderen)" })).toBeVisible();
  });

  it("says so when every course is already in it", () => {
    renderRoute(ProgrammePage, { ...data, available: [] });
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
