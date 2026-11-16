import { describe, expect, it } from "vitest";
import type { ComponentType } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import LearningLinePage from "~/routes/programmes.$id.lines.$lineId";
import LearningLines from "~/routes/learning-lines._index";
import { LearningLinesSection } from "~/components/programmes/LearningLinesSection";
import { learningLineOverview } from "~/lib/programmes/learningLine";

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

const courses = [
  {
    id: "c1",
    name: "Programmeren 1",
    outcomes: [{ id: "a", text: "Je schrijft code.", bloom: "create" as const }],
  },
  {
    id: "c2",
    name: "Programmeren 2",
    outcomes: [
      { id: "b", text: "Je schrijft code", bloom: "apply" as const },
      { id: "c", text: "Je test code." },
    ],
  },
];

const data = (canManage: boolean) => ({
  line: {
    id: "l1",
    name: "Programmeren",
    programmeId: "p1",
    programmeName: "HBO-ICT",
    teamName: "Informatica",
    canManage,
    courses: courses.map((c) => ({ id: c.id, name: c.name })),
  },
  overview: learningLineOverview(courses),
  addable: [{ id: "c3", name: "Databases" }],
  alsoFor: [] as { id: string; name: string }[],
  linkOptions: [] as { id: string; name: string; linked: boolean }[],
});

describe("Learning line page", () => {
  it("shows what comes back, per course with its Bloom level, and flags a drop", async () => {
    const { container } = renderRoute(LearningLinePage, data(false));
    expect(screen.getByRole("heading", { level: 1, name: "Programmeren" })).toBeVisible();
    // The path back (plan step 4): Opleidingen › HBO-ICT › Leerlijnen › Programmeren.
    const crumbs = screen.getByRole("navigation", { name: "Kruimelpad" });
    expect(within(crumbs).getByRole("link", { name: "Opleidingen" })).toHaveAttribute(
      "href",
      "/programmes",
    );
    expect(within(crumbs).getByRole("link", { name: "HBO-ICT" })).toHaveAttribute(
      "href",
      "/programmes/p1?tab=lines",
    );
    expect(within(crumbs).getByRole("link", { name: "Leerlijnen" })).toHaveAttribute(
      "href",
      "/learning-lines",
    );
    expect(within(crumbs).getByText("Programmeren")).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { level: 2, name: "Wat komt terug" })).toBeVisible();
    expect(screen.getByText("Het Bloom-niveau daalt")).toBeVisible();
    expect(screen.getAllByText("creëren").length).toBeGreaterThan(0);
    expect(screen.getByText("Je test code.")).toBeVisible();
    // A team member reads; only an admin changes the order.
    expect(screen.queryByRole("heading", { name: "Cursussen, op volgorde" })).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("gives the lead the courses in order, with Cursus toevoegen and Weghalen (plan step 6)", async () => {
    const user = userEvent.setup();
    const { container } = renderRoute(LearningLinePage, data(true));
    const list = screen.getByRole("region", { name: "Cursussen, op volgorde" });
    // An ordered list: the place in the line is the order of the rows.
    const rows = within(list).getAllByRole("listitem");
    expect(list.querySelector("ol")).not.toBeNull();
    expect(within(rows[0]!).getByText("Programmeren 1")).toBeVisible();
    expect(screen.getByRole("button", { name: "Omlaag (Programmeren 1)" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Omhoog (Programmeren 1)" })).toBeNull();
    expect(screen.getByRole("button", { name: "Omhoog (Programmeren 2)" })).toBeVisible();
    // Weghalen asks first, and says the course itself stays.
    await user.click(within(list).getByRole("button", { name: "Weghalen: Programmeren 2" }));
    const ask = screen.getByRole("dialog", {
      name: "Programmeren 2 weghalen uit de leerlijn Programmeren?",
    });
    expect(within(ask).getByText(/De cursus blijft bestaan/)).toBeVisible();
    await user.click(within(ask).getByRole("button", { name: "Annuleren" }));
    // Cursus toevoegen: search and ticks, several at once.
    await user.click(within(list).getByRole("button", { name: "Cursus toevoegen" }));
    const add = screen.getByRole("dialog", { name: "Cursussen toevoegen aan Programmeren" });
    expect(within(add).getByRole("checkbox", { name: "Databases" })).not.toBeChecked();
    await user.click(within(add).getByRole("button", { name: "Annuleren" }));
    // The name sits under Gegevens, deleting at the bottom.
    expect(screen.getByRole("region", { name: "Gegevens" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Leerlijn verwijderen" })).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("tells a reader which other programmes the line also holds for", () => {
    renderRoute(LearningLinePage, {
      ...data(false),
      alsoFor: [{ id: "p2", name: "HBO-ICT deeltijd" }],
      linkOptions: [],
    });
    expect(screen.getByText("Geldt ook voor: HBO-ICT deeltijd")).toBeVisible();
  });

  it("lets the lead tick the other programmes the line holds for", async () => {
    const { container } = renderRoute(LearningLinePage, {
      ...data(true),
      alsoFor: [],
      linkOptions: [
        { id: "p2", name: "HBO-ICT deeltijd", linked: true },
        { id: "p3", name: "AD Software", linked: false },
      ],
    });
    const group = screen.getByRole("group", { name: "Geldt ook voor andere opleidingen" });
    expect(group).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "HBO-ICT deeltijd" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "AD Software" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Opleidingen opslaan" })).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("says so when nothing comes back", () => {
    const single = learningLineOverview([courses[0]!]);
    renderRoute(LearningLinePage, { ...data(false), overview: single });
    expect(screen.getByText(/Geen leeruitkomst komt in een latere cursus terug/)).toBeVisible();
  });
});

describe("Learning lines on the programme page", () => {
  it("lists the lines and offers the lead a form with the programme's courses", async () => {
    const { container } = renderInRouter(
      <LearningLinesSection
        programmeId="p1"
        lines={[{ id: "l1", name: "Programmeren", courses: 2 }]}
        courses={[
          { courseId: "c1", name: "Programmeren 1" },
          { courseId: "c2", name: "Programmeren 2" },
        ]}
        canManage
      />,
    );
    expect(screen.getByRole("link", { name: "Programmeren" })).toHaveAttribute(
      "href",
      "/programmes/p1/lines/l1",
    );
    expect(screen.getByText("2 cursussen")).toBeVisible();
    expect(
      screen.getByRole("group", { name: "Welke cursussen horen bij de leerlijn?" }),
    ).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Programmeren 2" })).not.toBeChecked();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("names the programme a line comes from when it is another one", () => {
    renderInRouter(
      <LearningLinesSection
        programmeId="p2"
        lines={[{ id: "l1", name: "Onderzoek", courses: 3, from: "Pabo voltijd" }]}
        courses={[]}
        canManage={false}
      />,
    );
    expect(screen.getByText("uit Pabo voltijd")).toBeVisible();
  });

  it("shows a member the lines without the form", () => {
    renderInRouter(
      <LearningLinesSection programmeId="p1" lines={[]} courses={[]} canManage={false} />,
    );
    expect(screen.getByText("Nog geen leerlijnen in deze opleiding.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Leerlijn aanmaken" })).toBeNull();
  });
});

describe("Learning lines overview (/learning-lines, plan step 4)", () => {
  it("lists every line with its courses and programmes, each a link to its page", async () => {
    const { container } = renderRoute(LearningLines, {
      lines: [
        {
          id: "l1",
          name: "Onderzoek",
          href: "/programmes/p1/lines/l1",
          courses: 3,
          programmes: "Pabo voltijd, Pabo deeltijd",
        },
        {
          id: "l2",
          name: "Praktijk",
          href: "/programmes/p1/lines/l2",
          courses: 1,
          programmes: "Pabo voltijd",
        },
      ],
    });
    expect(screen.getByRole("heading", { level: 1, name: "Leerlijnen" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Onderzoek" })).toHaveAttribute(
      "href",
      "/programmes/p1/lines/l1",
    );
    expect(screen.getByText("3 cursussen · Pabo voltijd, Pabo deeltijd")).toBeVisible();
    expect(screen.getByText("1 cursus · Pabo voltijd")).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("says where a line is made when there is none, and points to the programmes", async () => {
    const { container } = renderRoute(LearningLines, { lines: [] });
    expect(screen.getByText("Nog geen leerlijnen")).toBeVisible();
    expect(screen.getByText(/op het tabblad Leerlijnen/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Opleidingen" })).toHaveAttribute(
      "href",
      "/programmes",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
