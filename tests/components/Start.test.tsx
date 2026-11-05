import { describe, expect, it } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import Start from "~/routes/start";

type Data = ComponentProps<typeof Start>["loaderData"];

const base: Data = {
  query: "",
  course: null,
  results: [],
  courses: [],
  week: { findings: [], recent: [] },
};

const full: Data = {
  ...base,
  courses: [
    { id: "c1", name: "Databases", findings: 2 },
    { id: "c2", name: "Netwerken", findings: 0 },
  ],
  week: {
    findings: [
      { courseId: "c1", courseName: "Databases", text: "Leeruitkomst 1 wordt niet getoetst." },
    ],
    recent: [
      {
        id: "g1",
        toolName: { nl: "Rubric maken", en: "Build a rubric" },
        createdAt: new Date("2026-11-04T10:00:00Z"),
      },
    ],
  },
};

function renderStart(data: Data, locale: "nl" | "en" = "nl") {
  const props = { loaderData: data } as unknown as ComponentProps<typeof Start>;
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      loader: () => ({ locale, user: null }),
      children: [{ path: "start", Component: () => <Start {...props} /> }],
    },
  ]);
  return render(<Stub initialEntries={["/start"]} />);
}

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

describe("Start (P27.3)", () => {
  it("shows the three blocks in order: question box, this week, your courses", async () => {
    renderStart(full);
    const h1 = await screen.findByRole("heading", {
      level: 1,
      name: "Waar wil je mee aan de slag?",
    });
    const headings = [
      ...screen.getAllByRole("heading", { level: 1 }),
      ...screen.getAllByRole("heading", { level: 2 }),
    ]
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
      .map((h) => h.textContent);
    expect(headings.slice(0, 3)).toEqual([h1.textContent, "Deze week", "Je cursussen"]);
  });

  it("asks with a GET form whose field is labelled, with an optional course", async () => {
    renderStart(full);
    const field = await screen.findByLabelText("Waar wil je mee aan de slag?");
    expect(field).toHaveAttribute("name", "q");
    const form = field.closest("form");
    expect(form).toHaveAttribute("method", "get");
    const course = screen.getByLabelText("Voor cursus (optioneel)");
    expect(
      within(course)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Geen cursus", "Databases", "Netwerken"]);
  });

  it("links each result with the chosen course", async () => {
    renderStart({
      ...full,
      query: "rubric",
      course: "c1",
      results: [
        {
          slug: "rubric-builder",
          name: { nl: "Rubric maken", en: "Build a rubric" },
          tagline: { nl: "Een rubric.", en: "A rubric." },
          icon: "grid",
        },
      ],
    });
    const link = await screen.findByRole("link", { name: /Een rubric\./ });
    expect(link).toHaveAttribute("href", "/tools/rubric-builder?course=c1");
  });

  it("says so when nothing matches, with a way to all tools", async () => {
    renderStart({ ...full, query: "xyzzy" });
    expect(await screen.findByText(/Geen tool gevonden/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Alle tools" })[0]).toHaveAttribute(
      "href",
      "/tools",
    );
  });

  it("lists open findings and recent work this week, and each course with its findings", async () => {
    renderStart(full);
    const week = await screen.findByRole("region", { name: "Deze week" });
    expect(
      within(week).getByRole("link", { name: /Leeruitkomst 1 wordt niet getoetst/ }),
    ).toHaveAttribute("href", "/courses/c1");
    expect(within(week).getByRole("link", { name: /Rubric maken/ })).toHaveAttribute(
      "href",
      "/projects",
    );
    const list = screen.getByRole("region", { name: "Je cursussen" });
    expect(within(list).getByRole("link", { name: /Databases/ })).toHaveAttribute(
      "href",
      "/courses/c1",
    );
    expect(within(list).getByText("2 aandachtspunten")).toBeInTheDocument();
  });

  it("offers 'Eerder gemaakt' and all tools from Start", async () => {
    renderStart(full);
    expect(await screen.findByRole("link", { name: "Eerder gemaakt" })).toHaveAttribute(
      "href",
      "/projects",
    );
    expect(screen.getAllByRole("link", { name: "Alle tools" })[0]).toHaveAttribute(
      "href",
      "/tools",
    );
  });

  it("shows only the question box and 'Maak je eerste cursus' without a course", async () => {
    renderStart(base);
    expect(await screen.findByRole("link", { name: "Maak je eerste cursus" })).toHaveAttribute(
      "href",
      "/courses",
    );
    expect(screen.getByText(/OER/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Deze week" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Je cursussen" })).toBeNull();
    expect(screen.queryByLabelText("Voor cursus (optioneel)")).toBeNull();
  });

  it("shows no course invitation when courses are switched off", async () => {
    renderStart({ ...base, courses: null });
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("link", { name: "Maak je eerste cursus" })).toBeNull();
  });

  it("renders in English", async () => {
    renderStart(full, "en");
    expect(
      await screen.findByRole("heading", { level: 1, name: "What do you want to work on?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "This week" })).toBeInTheDocument();
  });

  it("has no a11y violations, full and empty", async () => {
    const { container, unmount } = renderStart({
      ...full,
      query: "rubric",
      results: [
        {
          slug: "rubric-builder",
          name: { nl: "Rubric", en: "Rubric" },
          tagline: { nl: "x", en: "x" },
          icon: undefined,
        },
      ],
    });
    await screen.findByRole("heading", { level: 1 });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    unmount();
    const empty = renderStart(base);
    await screen.findByRole("heading", { level: 1 });
    expect((await axe(empty.container, axeOpts)).violations).toEqual([]);
  });
});
