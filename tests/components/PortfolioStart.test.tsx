import { describe, expect, it } from "vitest";
import type { ComponentType } from "react";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import PortfolioStart from "~/routes/portfolio.$id.start";
import { AnchorSummary } from "~/components/portfolio/AnchorForm";
import { anchorOptions } from "~/lib/portfolio/anchors";
import { emptyDossier } from "~/lib/portfolio/schema";
import type { StartStep } from "~/lib/portfolio/start";
import { dayPlan } from "~/lib/portfolio/plan";
import { LU, sampleDossier } from "../portfolio/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };
const ID = "dossier-1";

// biome-ignore lint/suspicious/noExplicitAny: route components take framework-typed props
function renderAt(Component: ComponentType<any>, loaderData: unknown, url: string) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <Component loaderData={loaderData} /> },
  ]);
  return render(<Stub initialEntries={[url]} />);
}

const course = {
  id: "c1",
  name: "Databases",
  options: anchorOptions({
    id: "c1",
    data: {
      activities: [{ id: "les-1", title: "Normaliseren", kind: "lesson", outcomeIds: [] }],
      assessments: [{ id: "toets-1", title: "Eindtoets", kind: "summative", coverage: [] }],
    },
  }),
};

function startData(step: StartStep, d = sampleDossier(), courses = [course]) {
  return {
    id: ID,
    name: "Mijn BDB",
    step,
    tracks: d.tracks,
    framework: d.framework,
    canExtract: true,
    anchors: d.anchors ?? {},
    courses,
    deadline: d.deadline,
    daysLeft: d.deadline ? 9 : undefined,
    hoursPerDay: d.hoursPerDay,
    plan: dayPlan(d, "2026-11-12"),
    today: "2026-11-12",
  };
}

const renderStep = (step: StartStep, d?: ReturnType<typeof sampleDossier>, courses = [course]) =>
  renderAt(PortfolioStart, startData(step, d, courses), `/?step=${step}`);

describe("the start wizard", () => {
  it("shows the four steps, marks the current one and leads on", async () => {
    const { container } = renderStep("track");
    const steps = screen.getByRole("navigation", { name: "Stappen van de start" });
    const links = within(steps).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "1.Traject",
      "2.Kader",
      "3.Ankers",
      "4.Planning",
    ]);
    expect(within(steps).getByRole("link", { name: /Traject/ })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByText("Stap 1 van 4")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /BDB/ })).toBeChecked();
    expect(screen.getByLabelText("Hogeschool of universiteit")).toHaveValue("Hogeschool X");
    expect(screen.getByRole("link", { name: "Volgende stap" })).toHaveAttribute(
      "href",
      `/portfolio/${ID}/start?step=framework`,
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("gets the framework from several files, or the national starting point", async () => {
    const { container } = renderStep("framework", emptyDossier(["bdb"]));
    expect(screen.getByLabelText(/bestand/i)).toHaveAttribute("multiple");
    expect(screen.getByRole("button", { name: "Startpunt gebruiken" })).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("sums up a framework that is in, with a way to check and confirm it", () => {
    renderStep("framework");
    expect(screen.getByText("1 leeruitkomsten met samen 2 criteria.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Controleer en pas aan" })).toHaveAttribute(
      "href",
      `/portfolio/${ID}/framework`,
    );
  });

  it("asks per outcome for a lesson, module or test from a course, or a description", async () => {
    const d = sampleDossier();
    d.anchors = { [LU]: { course: { courseId: "c1", itemId: "les-1" }, description: "Les 3" } };
    const { container } = renderStep("anchors", d);
    const group = screen.getByRole("group", { name: "LU1 Doceren" });
    expect(within(group).getByText(/Welke les laat je zien/)).toBeInTheDocument();
    const select = within(group).getByLabelText("Uit een cursus");
    expect(select).toHaveValue("c1:les-1");
    expect(
      within(group).getByRole("option", { name: "Les of opdracht: Normaliseren" }),
    ).toBeInTheDocument();
    expect(within(group).getByRole("option", { name: "Toets: Eindtoets" })).toBeInTheDocument();
    expect(within(group).getByLabelText("Of beschrijf het kort")).toHaveValue("Les 3");
    expect(screen.getByRole("button", { name: "Ankers opslaan" })).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("without courses, asks only for a description and points to Courses", () => {
    renderStep("anchors", sampleDossier(), []);
    expect(screen.queryByLabelText("Uit een cursus")).toBeNull();
    expect(screen.getByRole("link", { name: "Naar Cursussen" })).toHaveAttribute(
      "href",
      "/courses",
    );
  });

  it("plans the hand-in date and ends at the dossier", async () => {
    const d = sampleDossier();
    d.deadline = "2026-11-20";
    const { container } = renderStep("planning", d);
    expect(screen.getByLabelText("Inleverdatum")).toHaveValue("2026-11-20");
    expect(screen.getByText(/nog 9 dagen/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Dagplan" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Klaar, naar je dossier" })).toHaveAttribute(
      "href",
      `/portfolio/${ID}`,
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

it("asks how many hours a day you have for the plan", () => {
  const d = sampleDossier();
  d.hoursPerDay = 6;
  renderStep("planning", d);
  const hours = screen.getByLabelText("Uren per dag");
  expect(hours).toHaveValue(6);
  expect(hours).toHaveAttribute("min", "1");
  expect(hours).toHaveAttribute("max", "12");
  expect(hours.closest("form")).toBe(screen.getByLabelText("Inleverdatum").closest("form"));
});

describe("the anchor on an outcome", () => {
  it("says what the outcome is about and where to change it", async () => {
    const { container } = render(
      <AnchorSummaryAt
        view={{ kind: "test", course: "Databases", item: "Eindtoets", query: { course: "c1" } }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Waar gaat dit over?" })).toBeInTheDocument();
    expect(screen.getByText("Toets: Eindtoets uit Databases")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wijzig" })).toHaveAttribute(
      "href",
      `/portfolio/${ID}/start?step=anchors`,
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("says when the chosen course is gone", () => {
    render(<AnchorSummaryAt view={{ kind: "module", gone: true, query: {} }} />);
    expect(screen.getByText(/niet meer te vinden/)).toBeInTheDocument();
  });
});

function AnchorSummaryAt(props: Omit<Parameters<typeof AnchorSummary>[0], "changeHref">) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <AnchorSummary {...props} changeHref={`/portfolio/${ID}/start?step=anchors`} />
      ),
    },
  ]);
  return <Stub />;
}
