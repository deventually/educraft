import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub, useActionData } from "react-router";
import { RubricFill, type FillResult } from "~/components/utilities/RubricFill";
import { loadBatch } from "~/lib/privacy/localNames";
import { sampleRubric } from "../../utilities/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };
const NAME = "Sam Testpersoon";
const COMMENT = "Mooie analyse, bronnen nog netjes maken";

function renderFill(locale: "nl" | "en" = "nl", reply: FillResult = { closed: 1 }) {
  const posts: FormData[] = [];
  const rubric = { id: "rubric-fill-1", name: "Verslag", data: sampleRubric() };
  function Page() {
    const result = useActionData() as FillResult | undefined;
    return <RubricFill rubric={rubric} result={result} />;
  }
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      loader: () => ({ locale }),
      action: async ({ request }) => {
        posts.push(await request.formData());
        return reply;
      },
      Component: Page,
    },
  ]);
  const utils = render(<Stub initialEntries={["/"]} />);
  return { ...utils, posts, rubric };
}

async function addStudent(user: ReturnType<typeof userEvent.setup>, name: string) {
  const field = await screen.findByLabelText("Naam van de student (optioneel)");
  await user.clear(field);
  if (name) await user.type(field, name);
  await user.click(screen.getByRole("button", { name: "Student toevoegen" }));
}

let fetchSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  localStorage.clear();
  fetchSpy = vi.spyOn(globalThis, "fetch");
});
afterEach(() => fetchSpy.mockRestore());

describe("RubricFill", () => {
  it("says that names stay in the browser", async () => {
    renderFill();
    expect(await screen.findByText(/blijven alleen in deze browser/)).toBeInTheDocument();
  });

  it("gives each student a code and shows the name next to it", async () => {
    const user = userEvent.setup();
    renderFill();
    await addStudent(user, NAME);
    await addStudent(user, "");
    const table = screen.getByRole("table", { name: "Studenten in deze batch" });
    expect(within(table).getByText(`Student 1 — ${NAME}`)).toBeInTheDocument();
    expect(within(table).getByText("Student 2")).toBeInTheDocument();
  });

  it("choosing a level per criterion works out total, grade and result", async () => {
    const user = userEvent.setup();
    renderFill();
    await addStudent(user, NAME);
    const analyse = screen.getByRole("group", { name: "Analyse" });
    await user.click(within(analyse).getByRole("radio", { name: /Goed/ }));
    expect(screen.getByText("Nog niet alles ingevuld.")).toBeInTheDocument();
    const bronnen = screen.getByRole("group", { name: /Bronnen/ });
    await user.click(within(bronnen).getByRole("radio", { name: /Aanwezig/ }));
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("5 van de 5 punten");
    expect(status).toHaveTextContent("10,0");
    expect(status).toHaveTextContent("Voldoende");
  });

  it("a knock-out on its lowest level fails, whatever the total", async () => {
    const user = userEvent.setup();
    renderFill();
    await addStudent(user, "");
    await user.click(
      within(screen.getByRole("group", { name: "Analyse" })).getByRole("radio", { name: /Goed/ }),
    );
    await user.click(
      within(screen.getByRole("group", { name: /Bronnen/ })).getByRole("radio", {
        name: /Ontbreekt/,
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("ongeacht het totaal");
  });

  it("keeps the batch in this browser, and sends no name or comment when closing", async () => {
    const user = userEvent.setup();
    const { posts, rubric } = renderFill();
    await addStudent(user, NAME);
    await user.click(
      within(screen.getByRole("group", { name: "Analyse" })).getByRole("radio", { name: /Goed/ }),
    );
    await user.click(
      within(screen.getByRole("group", { name: /Bronnen/ })).getByRole("radio", {
        name: /Aanwezig/,
      }),
    );
    await user.type(screen.getByLabelText(/^Opmerking/), COMMENT);
    await waitFor(() => expect(loadBatch(rubric.id)?.students[0]?.comment).toBe(COMMENT));
    expect(loadBatch(rubric.id)?.students[0]?.name).toBe(NAME);

    await user.click(screen.getByRole("button", { name: "Batch afsluiten" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Batch afsluiten" }));
    await waitFor(() => expect(posts).toHaveLength(1));

    const sent = JSON.stringify([...posts[0]!.entries()]);
    expect(sent).not.toContain("Sam");
    expect(sent).not.toContain("Mooie");
    expect(sent).not.toMatch(/Student 1|"code"/);
    expect(posts[0]!.get("intent")).toBe("closeBatch");
    const scores = JSON.parse(String(posts[0]!.get("scoresJson")));
    expect(scores).toEqual([
      rubric.data.criteria.map((c, i) => ({
        criterionId: c.id,
        levelId: c.levels[i === 0 ? 2 : 1]!.id,
      })),
    ]);
    for (const call of fetchSpy.mock.calls) expect(JSON.stringify(call)).not.toContain("Sam");
  });

  it("closing wipes the names and comments from the browser", async () => {
    const user = userEvent.setup();
    const { rubric } = renderFill();
    await addStudent(user, NAME);
    await user.click(
      within(screen.getByRole("group", { name: "Analyse" })).getByRole("radio", { name: /Goed/ }),
    );
    await user.click(
      within(screen.getByRole("group", { name: /Bronnen/ })).getByRole("radio", {
        name: /Aanwezig/,
      }),
    );
    await waitFor(() => expect(loadBatch(rubric.id)).not.toBeNull());
    await user.click(screen.getByRole("button", { name: "Batch afsluiten" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Batch afsluiten" }),
    );
    await waitFor(() => expect(loadBatch(rubric.id)).toBeNull());
    expect(screen.queryByText(new RegExp(NAME))).not.toBeInTheDocument();
    expect(localStorage.length).toBe(0);
  });

  it("keeps the batch when the server refuses", async () => {
    const user = userEvent.setup();
    const { rubric } = renderFill("nl", { error: "invalid" });
    await addStudent(user, NAME);
    await user.click(
      within(screen.getByRole("group", { name: "Analyse" })).getByRole("radio", { name: /Goed/ }),
    );
    await user.click(
      within(screen.getByRole("group", { name: /Bronnen/ })).getByRole("radio", {
        name: /Aanwezig/,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Batch afsluiten" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Batch afsluiten" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(loadBatch(rubric.id)?.students[0]?.name).toBe(NAME);
  });

  it("offers no close until one student is complete", async () => {
    const user = userEvent.setup();
    renderFill();
    await addStudent(user, NAME);
    expect(screen.queryByRole("button", { name: "Batch afsluiten" })).not.toBeInTheDocument();
  });

  it("copies an overview with the names, for the teacher", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderFill();
    await addStudent(user, NAME);
    await user.click(screen.getByRole("button", { name: "Kopieer overzicht" }));
    const text = String(writeText.mock.calls[0]![0]);
    expect(text.split("\n")[0]).toMatch(/^Student\tAnalyse\tBronnen\t/);
    expect(text).toContain(`Student 1 — ${NAME}`);
  });

  it("has no a11y violations (NL)", async () => {
    const user = userEvent.setup();
    const { container } = renderFill("nl");
    await addStudent(user, NAME);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no a11y violations (EN)", async () => {
    const user = userEvent.setup();
    const { container } = renderFill("en");
    await user.type(await screen.findByLabelText("Student name (optional)"), "Kim");
    await user.click(screen.getByRole("button", { name: "Add student" }));
    expect(screen.getByRole("group", { name: "Analyse" })).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
