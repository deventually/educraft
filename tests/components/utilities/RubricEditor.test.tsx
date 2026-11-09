import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { RubricEditor } from "~/components/utilities/RubricEditor";
import { sampleRubric } from "../../utilities/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderEditor(locale: "nl" | "en" = "nl") {
  const posts: FormData[] = [];
  const rubric = { id: "r1", name: "Verslag", data: sampleRubric() };
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      loader: () => ({ locale }),
      action: async ({ request }) => {
        posts.push(await request.formData());
        return { ok: true };
      },
      Component: () => <RubricEditor rubric={rubric} />,
    },
  ]);
  const utils = render(<Stub initialEntries={["/"]} />);
  return { ...utils, posts };
}

const lastData = (posts: FormData[]) => JSON.parse(String(posts.at(-1)?.get("dataJson")));

describe("RubricEditor", () => {
  it("shows each criterion as a group with its levels", async () => {
    renderEditor();
    const first = await screen.findByRole("group", { name: "Criterium 1" });
    expect(within(first).getByLabelText("Criterium")).toHaveValue("Analyse");
    expect(within(first).getAllByRole("group", { name: /^Niveau \d$/ })).toHaveLength(3);
    expect(screen.getByText("Maximaal 5 punten.")).toBeInTheDocument();
  });

  it("adds a criterion and saves at once", async () => {
    const user = userEvent.setup();
    const { posts } = renderEditor();
    await user.click(await screen.findByRole("button", { name: "Criterium toevoegen" }));
    expect(screen.getByRole("group", { name: "Criterium 3" })).toBeInTheDocument();
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]!.get("intent")).toBe("save");
    expect(lastData(posts).criteria).toHaveLength(3);
  });

  it("adds a level to a criterion", async () => {
    const user = userEvent.setup();
    const { posts } = renderEditor();
    const second = await screen.findByRole("group", { name: "Criterium 2" });
    await user.click(within(second).getByRole("button", { name: "Niveau toevoegen" }));
    expect(within(second).getAllByRole("group", { name: /^Niveau \d$/ })).toHaveLength(3);
    await waitFor(() => expect(lastData(posts).criteria[1].levels).toHaveLength(3));
    // 4 + 2 = 6 points now.
    expect(screen.getByText("Maximaal 6 punten.")).toBeInTheDocument();
  });

  it("saves text on blur, not per keystroke", async () => {
    const user = userEvent.setup();
    const { posts } = renderEditor();
    const title = within(await screen.findByRole("group", { name: "Criterium 1" })).getByLabelText(
      "Criterium",
    );
    await user.clear(title);
    await user.type(title, "Analyseren");
    expect(posts).toHaveLength(0);
    await user.tab();
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(lastData(posts).criteria[0].title).toBe("Analyseren");
    expect(posts[0]!.get("name")).toBe("Verslag");
  });

  it("updates the points and the maximum", async () => {
    const user = userEvent.setup();
    const { posts } = renderEditor();
    const level = within(await screen.findByRole("group", { name: "Criterium 1" })).getByRole(
      "group",
      { name: "Niveau 3" },
    );
    const points = within(level).getByLabelText("Punten");
    await user.clear(points);
    await user.type(points, "10");
    await user.tab();
    await waitFor(() => expect(lastData(posts).criteria[0].levels[2].points).toBe(10));
    expect(screen.getByText("Maximaal 11 punten.")).toBeInTheDocument();
  });

  it("links to the grade calculator with the maximum filled in", async () => {
    renderEditor();
    expect(await screen.findByRole("link", { name: "Reken om naar een cijfer" })).toHaveAttribute(
      "href",
      "/utilities/grade-calculator?max=5",
    );
  });

  it("does not offer to remove the last criterion or go below two levels", async () => {
    renderEditor();
    const second = await screen.findByRole("group", { name: "Criterium 2" });
    expect(within(second).getByRole("button", { name: "Niveau 1 verwijderen" })).toBeDisabled();
  });

  it("copies the rubric as Markdown", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderEditor();
    await user.click(await screen.findByRole("button", { name: "Kopieer als Markdown" }));
    expect(String(writeText.mock.calls[0]![0])).toMatch(/^\| Criterium \| Niveau 1 \|/);
  });

  it("keeps the grade settings on the rubric, starting from the calculator's defaults", async () => {
    const user = userEvent.setup();
    const { posts } = renderEditor();
    const group = await screen.findByRole("group", { name: "Van punten naar cijfer" });
    expect(within(group).getByText(/OER van je opleiding/)).toBeInTheDocument();
    const pass = within(group).getByLabelText("Cesuur (percentage van de punten)");
    expect(pass).toHaveValue("55");
    await user.clear(pass);
    await user.type(pass, "60");
    await user.tab();
    await waitFor(() =>
      expect(lastData(posts).grade).toEqual({
        passPercent: 60,
        passGrade: 5.5,
        minGrade: 1,
        maxGrade: 10,
        decimals: 1,
      }),
    );
    await user.selectOptions(within(group).getByLabelText("Decimalen"), "0");
    await waitFor(() => expect(lastData(posts).grade.decimals).toBe(0));
  });

  it("shows a preview table with a caption", async () => {
    renderEditor();
    expect(
      await screen.findByRole("table", { name: "Rubric: criteria en niveaus" }),
    ).toBeInTheDocument();
  });

  it("has no a11y violations (NL)", async () => {
    const { container } = renderEditor("nl");
    await screen.findByRole("group", { name: "Criterium 1" });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no a11y violations (EN)", async () => {
    const { container } = renderEditor("en");
    await screen.findByRole("group", { name: "Criterion 1" });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
