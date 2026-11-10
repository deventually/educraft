import { describe, expect, it } from "vitest";
import type { ComponentType } from "react";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import LearningLinePage from "~/routes/programmes.$id.lines.$lineId";
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
});

describe("Learning line page", () => {
  it("shows what comes back, per course with its Bloom level, and flags a drop", async () => {
    const { container } = renderRoute(LearningLinePage, data(false));
    expect(screen.getByRole("heading", { level: 1, name: "Programmeren" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Terug naar HBO-ICT" })).toHaveAttribute(
      "href",
      "/programmes/p1",
    );
    expect(screen.getByRole("heading", { level: 2, name: "Wat komt terug" })).toBeVisible();
    expect(screen.getByText("Het Bloom-niveau daalt")).toBeVisible();
    expect(screen.getAllByText("creëren").length).toBeGreaterThan(0);
    expect(screen.getByText("Je test code.")).toBeVisible();
    // A team member reads; only the lead changes the order.
    expect(screen.queryByRole("heading", { name: "Volgorde" })).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("gives the lead buttons to move, remove and add courses", async () => {
    const { container } = renderRoute(LearningLinePage, data(true));
    expect(screen.getByRole("button", { name: "Omlaag (Programmeren 1)" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Omhoog (Programmeren 1)" })).toBeNull();
    expect(screen.getByRole("button", { name: "Omhoog (Programmeren 2)" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Uit de leerlijn (Programmeren 2)" })).toBeVisible();
    expect(screen.getByLabelText("Cursus toevoegen aan de leerlijn")).toHaveDisplayValue(
      "Databases",
    );
    expect(screen.getByRole("button", { name: "Leerlijn verwijderen" })).toBeVisible();
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

  it("shows a member the lines without the form", () => {
    renderInRouter(
      <LearningLinesSection programmeId="p1" lines={[]} courses={[]} canManage={false} />,
    );
    expect(screen.getByText("Nog geen leerlijnen in deze opleiding.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Leerlijn aanmaken" })).toBeNull();
  });
});
