import { describe, expect, it } from "vitest";
import type { ComponentType } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import CourseList from "~/routes/courses._index";
import CoursePage from "~/routes/courses.$id";
import { checkAlignment, coverageMatrix } from "~/lib/courses/alignment";
import { emptyCourseData } from "~/lib/courses/schema";
import type { CourseData } from "~/lib/courses/types";
import { alignedCourse, documentedCourse, itemizedCourse } from "../courses/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

// createRoutesStub doesn't inject loaderData in library mode; pass it through a wrapper.
// biome-ignore lint/suspicious/noExplicitAny: route components take framework-typed props
function renderRoute(Component: ComponentType<any>, loaderData: unknown, entry = "/") {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <Component loaderData={loaderData} /> },
  ]);
  return render(<Stub initialEntries={[entry]} />);
}

function pageData(data: CourseData = alignedCourse()) {
  return {
    course: { id: "c1", name: "Software Engineering — jaar 2", contextProfileId: null, data },
    profiles: [{ id: "p1", name: "SE jaar 2" }],
    findings: checkAlignment(data),
    matrix: coverageMatrix(data),
    linkedWork: [] as {
      generationId: string;
      toolName: { nl: string; en: string } | string;
      itemTitle: string | null;
      createdAt: Date;
      blueprint?: unknown;
    }[],
    dossiers: [] as unknown[],
  };
}

describe("Course list (/courses)", () => {
  it("shows a create form and a guided empty state", async () => {
    const { container } = renderRoute(CourseList, { courses: [], profiles: [] });
    expect(screen.getByRole("heading", { level: 1, name: "Cursussen" })).toBeVisible();
    expect(screen.getByLabelText("Naam")).toBeRequired();
    expect(screen.getByLabelText("Onderwijscontext")).toHaveDisplayValue("Geen");
    expect(screen.getByRole("heading", { level: 2, name: "Nog geen cursus" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Opleidingen" })).toHaveAttribute(
      "href",
      "/programmes",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("lists courses with their outcomes and findings as text", async () => {
    const { container } = renderRoute(CourseList, {
      courses: [
        {
          id: "c1",
          name: "SE jaar 2",
          outcomes: 3,
          findings: 2,
          progress: { complete: 2, total: 6, next: "assessments" },
        },
      ],
      profiles: [{ id: "p1", name: "SE" }],
    });
    expect(screen.getByRole("link", { name: "SE jaar 2" })).toHaveAttribute("href", "/courses/c1");
    expect(screen.getByText("3 leeruitkomsten · 2 aandachtspunten")).toBeVisible();
    expect(screen.getByText("2 van 6 stappen klaar · Volgende stap: Toetsen")).toBeVisible();
    expect(screen.getByRole("button", { name: "Verwijderen: SE jaar 2" })).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

// Seam: the rendered page at a URL. A tab is a link with aria-current, its blocks are regions.
describe("Course page — tabs", () => {
  const nav = () => screen.getByRole("navigation", { name: "Onderdelen van de cursus" });
  const headings = () =>
    screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent?.trim());

  it("offers five tabs as links, the overview current by default", async () => {
    const { container } = renderRoute(CoursePage, pageData());
    const links = within(nav()).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "Overzicht",
      "Leeruitkomsten",
      "Lessen en toetsen",
      "Controle",
      "Documenten en delen",
    ]);
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/courses/c1",
      "/courses/c1?tab=outcomes",
      "/courses/c1?tab=plan",
      "/courses/c1?tab=check",
      "/courses/c1?tab=documents",
    ]);
    expect(within(nav()).getByRole("link", { name: "Overzicht" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows the settings, the schedule and the week on the overview, nothing else", () => {
    renderRoute(CoursePage, pageData());
    expect(headings()).toEqual([
      "Voortgang",
      "Cursusgegevens",
      "Lesrooster",
      "Disciplines",
      "Per week",
    ]);
  });

  it("shows the learning outcomes on their own tab", async () => {
    const { container } = renderRoute(CoursePage, pageData(), "/?tab=outcomes");
    expect(headings()).toEqual(["Leeruitkomsten"]);
    expect(within(nav()).getByRole("link", { name: "Leeruitkomsten" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav()).getByRole("link", { name: "Overzicht" })).not.toHaveAttribute(
      "aria-current",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("puts lessons and tests together", async () => {
    const { container } = renderRoute(CoursePage, pageData(), "/?tab=plan");
    expect(headings()).toEqual(["Onderwijsactiviteiten", "Toetsen"]);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("puts the matrix and the findings together under Controle", async () => {
    const { container } = renderRoute(CoursePage, pageData(), "/?tab=check");
    expect(headings()).toEqual(["Dekkingsmatrix", "Aandachtspunten"]);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("puts made work and sharing under Documenten en delen", async () => {
    const { container } = renderRoute(CoursePage, pageData(), "/?tab=documents");
    expect(headings()).toContain("Gekoppeld werk");
    expect(headings()).toContain("Modulewijzer en modulehandleiding");
    expect(headings()).not.toContain("Cursusgegevens");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("counts the open findings on the Controle tab", () => {
    const d = alignedCourse();
    d.assessments[1]!.coverage[0]!.bloom = "understand";
    renderRoute(CoursePage, pageData(d));
    expect(within(nav()).getByRole("link", { name: "Controle (1)" })).toBeVisible();
  });

  it("falls back to the overview for an unknown tab", () => {
    renderRoute(CoursePage, pageData(), "/?tab=nonsense");
    expect(headings()).toEqual([
      "Voortgang",
      "Cursusgegevens",
      "Lesrooster",
      "Disciplines",
      "Per week",
    ]);
  });
});

describe("Course editor (/courses/:id)", () => {
  it("says on the Controle tab when everything is aligned", async () => {
    const { container } = renderRoute(CoursePage, pageData(), "/?tab=check");
    expect(screen.getByText("Geen aandachtspunten. Alles sluit op elkaar aan.")).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("asks per assessment whether it is supervised, and shows the answer", async () => {
    const data = alignedCourse();
    data.assessments[1] = { ...data.assessments[1]!, supervised: false };
    const { container } = renderRoute(CoursePage, pageData(data), "/?tab=plan");
    const boxes = screen.getAllByRole("combobox", { name: "Onder toezicht" });
    // One per existing assessment, plus the form for a new one.
    expect(boxes).toHaveLength(3);
    expect(boxes[1]).toHaveValue("no");
    expect(boxes[2]).toHaveValue("");
    expect(within(boxes[2]!).getByRole("option", { name: "Niet ingevuld" })).toBeInTheDocument();
    expect(within(boxes[2]!).getByRole("option", { name: "Ja, onder toezicht" })).toHaveValue(
      "yes",
    );
    expect(within(boxes[2]!).getByRole("option", { name: "Nee, zonder toezicht" })).toHaveValue(
      "no",
    );
    expect(screen.getByText(/Zonder toezicht/)).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows the matrix as a real table with a caption, scoped headers and text cells", () => {
    renderRoute(CoursePage, pageData(), "/?tab=check");
    const table = screen.getByRole("table", {
      name: "Welke activiteit en welke toets dekt welke leeruitkomst",
    });
    expect(within(table).getByRole("columnheader", { name: /Eindopdracht/ })).toHaveAttribute(
      "scope",
      "col",
    );
    const lu1 = within(table).getByRole("rowheader", { name: "LU1" });
    expect(lu1).toHaveAttribute("scope", "row");
    const row = lu1.closest("tr") as HTMLElement;
    // Les normaliseren · Opdracht datamodel · Oefentoets · Eindopdracht
    const cells = within(row).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("niet gedekt");
    expect(cells[1]).toHaveTextContent("gedekt");
    expect(cells[3]).toHaveTextContent("creëren");
  });

  it("renders a finding as text with the outcome and the item", async () => {
    const d = alignedCourse();
    d.assessments[1]!.coverage[0]!.bloom = "understand";
    const { container } = renderRoute(CoursePage, pageData(d), "/?tab=check");
    expect(
      screen.getByText("Eindopdracht toetst LU1 onder het niveau van de leeruitkomst.", {
        exact: false,
      }),
    ).toBeVisible();
    expect(screen.getByText("Let op:")).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("asks how to start an empty course, first on the overview", async () => {
    const first = () => screen.getAllByRole("heading", { level: 2 })[0]?.textContent;
    const { container } = renderRoute(CoursePage, {
      ...pageData(emptyCourseData()),
      courseDesign: true,
    });
    expect(first()).toBe("Hoe wil je beginnen?");
    expect(screen.getByText("In grote lijnen ontwerpen")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Naar importeren" })).toBeTruthy();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    cleanup();
    renderRoute(CoursePage, pageData(emptyCourseData()));
    // Without the wizard, a document or an empty start remain.
    expect(first()).toBe("Hoe wil je beginnen?");
    expect(screen.queryByText("In grote lijnen ontwerpen")).toBeNull();
  });

  it("guides an empty course and asks for outcomes first", async () => {
    const outcomes = renderRoute(CoursePage, pageData(emptyCourseData()), "/?tab=outcomes");
    expect(screen.getByText("Nog geen leeruitkomsten.")).toBeVisible();
    expect((await axe(outcomes.container, axeOpts)).violations).toEqual([]);
    outcomes.unmount();
    renderRoute(CoursePage, pageData(emptyCourseData()), "/?tab=check");
    expect(
      screen.getByText("Voeg leeruitkomsten en activiteiten of toetsen toe om de matrix te zien."),
    ).toBeVisible();
    cleanup();
    const { container } = renderRoute(CoursePage, pageData(emptyCourseData()), "/?tab=plan");
    expect(screen.getAllByText("Voeg eerst leeruitkomsten toe.").length).toBeGreaterThan(0);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

/** Opens the matrix disclosure of a test, as a user would. */
function openMatrix(name: string) {
  const summary = screen.getByText(name, { selector: "summary" });
  (summary.closest("details") as HTMLDetailsElement).open = true;
}

describe("Course editor — real dates (P22.1)", () => {
  /** The list item of an activity or assessment, inside its own section. */
  const itemIn = (section: string, title: string) =>
    within(screen.getByRole("region", { name: section }))
      .getByText(title)
      .closest("li") as HTMLElement;
  const dated = () => ({ ...alignedCourse(), startDate: "2026-11-11" });
  const weekDates = ["2026-11-09", "2026-11-16", "2026-11-30", "2026-12-07"];

  it("has a labelled start date field with a hint", async () => {
    const { container } = renderRoute(CoursePage, { ...pageData(dated()), weekDates });
    const field = screen.getByLabelText("Startdatum") as HTMLInputElement;
    expect(field.type).toBe("date");
    expect(field.name).toBe("startDate");
    expect(field.value).toBe("2026-11-11");
    expect(field).toHaveAccessibleDescription(/week 1 begint in deze week/i);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows the dates of each week next to the week number", () => {
    const { container } = renderRoute(
      CoursePage,
      { ...pageData(dated()), weekDates },
      "/?tab=plan",
    );
    const lesson = itemIn("Onderwijsactiviteiten", "Opdracht datamodel");
    expect(lesson).toHaveTextContent(/Week 2 · 16.22 nov/);
    expect(container.querySelector('time[datetime="2026-11-16"]')).not.toBeNull();
    const exam = itemIn("Toetsen", "Eindopdracht");
    expect(exam).toHaveTextContent(/Week 4 · 7.13 dec/);
  });

  it("gives each activity and assessment an anchor for the week on Start (P22.3)", () => {
    renderRoute(CoursePage, { ...pageData(dated()), weekDates }, "/?tab=plan");
    expect(itemIn("Onderwijsactiviteiten", "Opdracht datamodel")).toHaveAttribute(
      "id",
      "item-act-2",
    );
    expect(itemIn("Toetsen", "Eindopdracht")).toHaveAttribute("id", "item-test-1");
  });

  it("offers the calendar file with a start date, and not without (P22.4)", () => {
    renderRoute(CoursePage, { ...pageData(dated()), weekDates });
    const link = screen.getByRole("link", { name: "Zet in je agenda" });
    expect(link).toHaveAttribute("href", "/courses/c1/calendar.ics");
    expect(link).toHaveAttribute("download");
    expect(link).toHaveAccessibleDescription(/agendabestand/i);
  });

  it("has no calendar link without a start date (P22.4)", () => {
    renderRoute(CoursePage, { ...pageData(), weekDates: null });
    expect(screen.queryByRole("link", { name: "Zet in je agenda" })).toBeNull();
  });

  it("shows only the week number without a start date", () => {
    const overview = renderRoute(CoursePage, { ...pageData(), weekDates: null });
    expect(screen.getByLabelText("Startdatum")).toHaveValue("");
    overview.unmount();
    const { container } = renderRoute(CoursePage, { ...pageData(), weekDates: null }, "/?tab=plan");
    const lesson = itemIn("Onderwijsactiviteiten", "Opdracht datamodel");
    expect(lesson).toHaveTextContent("Week 2");
    expect(container.querySelector("time")).toBeNull();
  });
});

describe("Course editor — question-level matrix (P26.1)", () => {
  it("shows each test's matrix as a real table with a caption and a total row", async () => {
    const { container } = renderRoute(CoursePage, pageData(itemizedCourse()), "/?tab=plan");
    expect(screen.getByText("Vragen (4)", { exact: false })).toBeVisible();
    openMatrix("Vragen (4)");
    const table = screen.getByRole("table", { name: "Vragen: Eindopdracht" });
    for (const name of ["Vraag", "Leeruitkomst", "Denkniveau", "Vraagvorm", "Punten"])
      expect(within(table).getByRole("columnheader", { name })).toHaveAttribute("scope", "col");
    expect(within(table).getByRole("combobox", { name: "Leeruitkomst van vraag 3" })).toHaveValue(
      "lo-2",
    );
    expect(within(table).getByRole("textbox", { name: "Punten van vraag 1" })).toHaveValue("10");
    const total = within(table).getByRole("rowheader", { name: "Totaal" });
    const totalRow = total.closest("tr") as HTMLElement;
    expect(totalRow).toHaveTextContent("4 vragen, 25 punten");
    expect(totalRow).toHaveTextContent("LU1: 80%");
    expect(totalRow).toHaveTextContent("LU2: 20%");
    expect(
      within(table).getByRole("button", { name: /Verwijderen\W+vraag 4/ }),
    ).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("offers a question form that works without JavaScript", () => {
    renderRoute(CoursePage, pageData(itemizedCourse()), "/?tab=plan");
    openMatrix("Vragen (4)");
    const add = screen.getByRole("button", { name: /Vraag toevoegen\W+Eindopdracht/ });
    const form = add.closest("form") as HTMLFormElement;
    expect(form).toHaveAttribute("method", "post");
    expect(form.querySelector('input[name="intent"]')).toHaveValue("add-item");
    expect(form.querySelector('input[name="assessmentId"]')).toHaveValue("test-1");
  });

  it("the coverage matrix counts the questions, and the test form says coverage follows them", () => {
    renderRoute(CoursePage, pageData(itemizedCourse()), "/?tab=check");
    const table = screen.getByRole("table", {
      name: "Welke activiteit en welke toets dekt welke leeruitkomst",
    });
    const row = within(table).getByRole("rowheader", { name: "LU1" }).closest("tr") as HTMLElement;
    expect(within(row).getAllByRole("cell")[3]).toHaveTextContent("2 vragen");
    cleanup();
    renderRoute(CoursePage, pageData(itemizedCourse()), "/?tab=plan");
    expect(
      screen.getAllByText("De dekking volgt uit de toetsmatrijs.", { exact: false }).length,
    ).toBeGreaterThan(0);
  });

  it("names the question in a question-level finding", () => {
    const d = itemizedCourse();
    d.assessments[1]!.items![1]!.bloom = "apply";
    renderRoute(CoursePage, pageData(d), "/?tab=check");
    expect(
      screen.getByText(
        "Vraag 2 van Eindopdracht toetst LU1 onder het niveau van de leeruitkomst.",
        {
          exact: false,
        },
      ),
    ).toBeVisible();
  });
});

describe("Course page — linked work (20.4)", () => {
  it("guides an empty section to the tools and Eerder gemaakt", () => {
    renderRoute(CoursePage, pageData(), "/?tab=documents");
    const section = screen.getByRole("region", { name: "Gekoppeld werk" });
    expect(within(section).getByText(/Nog niets gekoppeld/)).toBeVisible();
  });

  it("lists linked work with its tool, item and a way back to Eerder gemaakt", async () => {
    const data = {
      ...pageData(),
      linkedWork: [
        {
          generationId: "g1",
          toolName: { nl: "Authentieke toets ontwerpen", en: "Design an authentic assessment" },
          itemTitle: "Eindopdracht",
          createdAt: new Date("2026-11-05T10:00:00Z"),
        },
      ],
    };
    const { container } = renderRoute(CoursePage, data, "/?tab=documents");
    const section = screen.getByRole("region", { name: "Gekoppeld werk" });
    expect(within(section).getByText("Authentieke toets ontwerpen")).toBeVisible();
    expect(within(section).getByText(/Eindopdracht/)).toBeVisible();
    expect(within(section).getByRole("link", { name: "Bekijk in Eerder gemaakt" })).toHaveAttribute(
      "href",
      "/projects",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("Course page — blueprint into the course (P26.2)", () => {
  const work = (blueprint: unknown) => ({
    ...pageData(itemizedCourse()),
    linkedWork: [
      {
        generationId: "g1",
        toolName: { nl: "Toetsvragen en toetsmatrijs maken", en: "Write test questions" },
        itemTitle: null,
        createdAt: new Date("2026-11-05T10:00:00Z"),
        blueprint,
      },
    ],
  });
  const offer = {
    rows: [
      {
        row: "R1",
        outcomeName: "Je ontwerpt een datamodel.",
        bloom: "create",
        format: "open",
        count: 2,
        pointsPerItem: 5,
      },
      {
        row: "R2",
        outcomeName: "Normaliseren",
        bloom: "understand",
        format: "multiple-choice",
        count: 3,
        pointsPerItem: 1,
      },
    ],
    totalMismatch: true,
    proposal: { R1: "lo-1", R2: "" },
  };

  it("offers a confirm form with the proposal selected, per row", async () => {
    const { container } = renderRoute(CoursePage, work(offer), "/?tab=documents");
    const section = screen.getByRole("region", { name: "Gekoppeld werk" });
    const summary = within(section).getByText("Zet matrijs in cursus", { selector: "summary" });
    (summary.closest("details") as HTMLDetailsElement).open = true;
    const form = within(section)
      .getByRole("button", { name: "Matrijs overnemen" })
      .closest("form") as HTMLFormElement;
    expect(form).toHaveAttribute("method", "post");
    expect(form.querySelector('input[name="intent"]')).toHaveValue("import-blueprint");
    expect(form.querySelector('input[name="generationId"]')).toHaveValue("g1");
    expect(within(form).getByRole("combobox", { name: "Leeruitkomst voor R1" })).toHaveValue(
      "lo-1",
    );
    expect(within(form).getByRole("combobox", { name: "Leeruitkomst voor R2" })).toHaveValue("");
    expect(within(form).getByText(/2 vragen · creëren · Open vraag · 5 per vraag/)).toBeVisible();
    const target = within(form).getByRole("combobox", { name: "In welke toets?" });
    expect(within(target).getByRole("option", { name: "Nieuwe summatieve toets" })).toBeVisible();
    expect(within(target).getByRole("option", { name: "Eindopdracht" })).toBeVisible();
    expect(
      within(form).getByRole("checkbox", { name: "Vervang de bestaande vragen van deze toets" }),
    ).not.toBeChecked();
    expect(within(form).getByText(/de regel Totaal klopt niet/)).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("says why a result cannot become a blueprint, without a button", () => {
    renderRoute(CoursePage, work({ error: "no-table" }), "/?tab=documents");
    const section = screen.getByRole("region", { name: "Gekoppeld werk" });
    expect(
      within(section).getByText(
        "Deze matrijs kan niet in de cursus: er staat geen toetsmatrijs-tabel in dit resultaat.",
      ),
    ).toBeVisible();
    expect(within(section).queryByText("Zet matrijs in cursus")).toBeNull();
  });
});

describe("Course page — use as evidence in BDB/BKE (P26.4)", () => {
  const dossiers = [
    {
      id: "d1",
      name: "Mijn BKE",
      outcomes: [
        {
          code: "K2",
          title: "Toetsconstructie",
          criteria: [{ id: "k2a", text: "Je stelt een toetsmatrijs op." }],
        },
      ],
    },
  ];

  it("offers part, dossier and criteria in a plain form", async () => {
    const { container } = renderRoute(
      CoursePage,
      { ...pageData(itemizedCourse()), dossiers },
      "/?tab=documents",
    );
    const summary = screen.getByText("Gebruik als bewijs in BDB/BKE", { selector: "summary" });
    (summary.closest("details") as HTMLDetailsElement).open = true;
    const form = screen
      .getByRole("button", { name: "Toevoegen aan dossier" })
      .closest("form") as HTMLFormElement;
    expect(form.querySelector('input[name="intent"]')).toHaveValue("use-as-evidence");
    const part = within(form).getByRole("combobox", { name: "Wat wil je als bewijs gebruiken?" });
    expect(
      within(part).getByRole("option", { name: "Leeruitkomsten en dekkingsmatrix" }),
    ).toHaveValue("outcomes-and-matrix");
    expect(within(part).getByRole("option", { name: "Toetsmatrijs: Eindopdracht" })).toHaveValue(
      "assessment:test-1",
    );
    expect(within(form).getByRole("combobox", { name: "Dossier" })).toHaveValue("d1");
    const group = within(form).getByRole("group", { name: "Mijn BKE: K2 Toetsconstructie" });
    expect(
      within(group).getByRole("checkbox", { name: "Je stelt een toetsmatrijs op." }),
    ).toHaveAttribute("value", "k2a");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("is absent without dossiers", () => {
    renderRoute(CoursePage, pageData(), "/?tab=documents");
    expect(screen.queryByText("Gebruik als bewijs in BDB/BKE")).toBeNull();
  });
});

describe("Course editor — pack tags on learning outcomes (P21.6)", () => {
  async function withPack() {
    const { getDomainPack } = await import("~/lib/context/packs");
    const data = alignedCourse();
    data.outcomes[0]!.packTags = { beheersingsniveau: 3, activiteiten: ["Ontwerpen"] };
    return { ...pageData(data), pack: getDomainPack("ICT") };
  }

  it("shows the tags and offers the pack's fields in the outcome forms", async () => {
    const { container } = renderRoute(CoursePage, await withPack(), "/?tab=outcomes");
    expect(screen.getByText(/Beheersingsniveau: 3/)).toBeVisible();
    expect(screen.getAllByText(/Beroepsactiviteiten: Ontwerpen/).length).toBeGreaterThan(0);
    // The add form: a fieldset per multiselect, a select for the level.
    const add = screen
      .getByRole("button", { name: "Leeruitkomst toevoegen" })
      .closest("form") as HTMLElement;
    const group = within(add).getByRole("group", { name: "Architectuurlagen" });
    expect(within(group).getByRole("checkbox", { name: "Software" })).toHaveAttribute(
      "name",
      "tag:architectuurlagen",
    );
    expect(within(add).getByLabelText("Beheersingsniveau")).toHaveAttribute(
      "name",
      "tag:beheersingsniveau",
    );
    expect(within(add).getByText(/hbo-i domeinbeschrijving/)).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("offers no tag fields without a pack", () => {
    renderRoute(CoursePage, pageData(), "/?tab=outcomes");
    expect(screen.queryByLabelText("Beheersingsniveau")).toBeNull();
  });
});

describe("Course page — blueprint and marking model", () => {
  it("asks for the module details in the module guide, with its own form and export", async () => {
    const data = { ...documentedCourse(), leader: "Docent A", description: "Over databases." };
    const { container } = renderRoute(CoursePage, pageData(data), "/?tab=documents");
    const guide = screen.getByRole("region", { name: "Modulewijzer en modulehandleiding" });
    expect(within(guide).getByLabelText("Modulecode")).toHaveValue("DB1");
    expect(within(guide).getByLabelText("Studiejaar")).toHaveValue("2026-2027");
    expect(within(guide).getByLabelText("Studiefase")).toHaveValue("");
    expect(within(guide).getByLabelText("Moduleleider")).toHaveValue("Docent A");
    expect(within(guide).getByLabelText("Examinator(en)")).toHaveValue("");
    expect(within(guide).getByLabelText("Inhoudelijke beschrijving")).toHaveValue(
      "Over databases.",
    );
    const form = within(guide).getByRole("button", { name: "Opslaan" }).closest("form");
    expect(form?.querySelector('input[name="intent"]')).toHaveValue("set-module");
    expect(
      within(guide)
        .getByText("Modulewijzer exporteren", { selector: "summary" })
        .closest("details"),
    ).toHaveAttribute("data-export-url", "/courses/c1/documents/module-guide/export");
    expect(within(guide).getByLabelText("Literatuur")).toHaveValue("");
    expect(
      within(guide)
        .getByText("Modulehandleiding exporteren", { selector: "summary" })
        .closest("details"),
    ).toHaveAttribute("data-export-url", "/courses/c1/documents/module-handbook/export");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    cleanup();
    // The settings on the overview no longer ask for the module code.
    renderRoute(CoursePage, pageData(data));
    const settings = screen.getByRole("region", { name: "Cursusgegevens" });
    expect(within(settings).queryByLabelText("Modulecode")).toBeNull();
  });

  it("asks for success criteria per learning outcome, one per line with a code", () => {
    renderRoute(CoursePage, pageData(documentedCourse()), "/?tab=outcomes");
    const fields = screen.getAllByLabelText("Succescriteria");
    expect(fields[0]).toHaveValue(
      "S-An 1.1: De student registreert requirements.\nHet model is genormaliseerd.",
    );
    expect(screen.getByRole("list", { name: "Succescriteria LU1" })).toHaveTextContent(
      "S-An 1.1 De student registreert requirements.",
    );
  });

  it("has a details form per test that works without JavaScript", async () => {
    const { container } = renderRoute(CoursePage, pageData(documentedCourse()), "/?tab=plan");
    // One per test; the final test is the second.
    const summary = screen.getAllByText("Gegevens voor toetsmatrijs en nakijkmodel", {
      selector: "summary",
    })[1]!;
    const details = summary.closest("details") as HTMLElement;
    const form = details.querySelector("form") as HTMLFormElement;
    expect(form.querySelector('input[name="intent"]')).toHaveValue("update-assessment-details");
    expect(within(details).getByLabelText("Toetsvorm")).toHaveValue("Andere wijze");
    expect(within(details).getByLabelText("Beoordeling")).toHaveValue("pass-fail");
    expect(within(details).getByLabelText("Cesuur (%)")).toHaveValue("75");
    expect(within(details).getByLabelText("Voorwaarden voor een voldoende")).toHaveValue(
      "Alle opdrachten ingeleverd.\nDeelgenomen aan het gesprek.",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("lists the parts of a test, each editable, and a form to add one", async () => {
    const { container } = renderRoute(CoursePage, pageData(documentedCourse()), "/?tab=plan");
    const summary = screen.getByText("Onderdelen (2)", { selector: "summary" });
    const details = summary.closest("details") as HTMLElement;
    expect(within(details).getByText("Datamodel")).toBeInTheDocument();
    expect(within(details).getByText(/LU1 · Weging: 60% · Knock-out: ja/)).toBeInTheDocument();
    const add = within(details).getByRole("button", { name: /Onderdeel toevoegen/ });
    const form = add.closest("form") as HTMLFormElement;
    expect(form.querySelector('input[name="intent"]')).toHaveValue("add-part");
    expect(form.querySelector('input[name="assessmentId"]')).toHaveValue("test-1");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("offers the blueprint for every test, and the marking model where there are parts", () => {
    renderRoute(CoursePage, pageData(documentedCourse()), "/?tab=plan");
    const panels = (name: string) =>
      screen
        .getAllByText(name, { selector: "summary" })
        .map((s) => s.closest("details")?.getAttribute("data-export-url"));
    expect(panels("Toetsmatrijs exporteren")).toEqual([
      "/courses/c1/assessments/quiz-1/blueprint/export",
      "/courses/c1/assessments/test-1/blueprint/export",
    ]);
    expect(panels("Nakijkmodel exporteren")).toEqual([
      "/courses/c1/assessments/test-1/marking-model/export",
    ]);
  });
});
