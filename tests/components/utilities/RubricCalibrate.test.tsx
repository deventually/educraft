import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { RubricCalibrate } from "~/components/utilities/RubricCalibrate";
import { ToastProvider } from "~/components/Toast";
import RubricPage from "~/routes/utilities.rubric.$id";
import { sampleRubric } from "../../utilities/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderCalibrate(locale: "nl" | "en" = "nl") {
  const rubric = { id: "rubric-cal-1", name: "Eindwerk", data: sampleRubric() };
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      loader: () => ({ locale }),
      Component: () => <RubricCalibrate rubric={rubric} />,
    },
  ]);
  return { ...render(<Stub initialEntries={["/"]} />), rubric };
}

/** Paste `text` into rater `n`'s box (1 or 2) and take it over. */
async function paste(user: ReturnType<typeof userEvent.setup>, n: 1 | 2, text: string) {
  const group = await screen.findByRole("group", { name: `Beoordelaar ${n}` });
  const box = within(group).getByLabelText("Plak uit Excel");
  await user.click(box);
  await user.paste(text);
  await user.click(within(group).getByRole("button", { name: "Overnemen" }));
  return group;
}

let fetchSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch");
});
afterEach(() => fetchSpy.mockRestore());

describe("RubricCalibrate", () => {
  it("says nothing is kept, and offers the example CSV", async () => {
    renderCalibrate();
    expect(
      await screen.findByText("Niets hiervan wordt bewaard. Sluit je deze pagina, dan is het weg."),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Voorbeeld-CSV/ });
    expect(link).toHaveAttribute("download");
    expect(decodeURIComponent(link.getAttribute("href") ?? "")).toContain("code;Analyse;Bronnen");
  });

  it("sets the two raters side by side after pasting, and posts nothing", async () => {
    const user = userEvent.setup();
    renderCalibrate();
    await paste(user, 1, "A1\tGoed\tAanwezig\nA2\tVoldoende\tAanwezig\nA3\tGoed\tAanwezig");
    await paste(user, 2, "A1\tGoed\tAanwezig\nA2\tGoed\tAanwezig\nA4\tGoed\tAanwezig");

    const perCriterion = screen.getByRole("table", { name: "Overeenstemming per criterium" });
    const analyse = within(perCriterion).getByRole("row", { name: /Analyse/ });
    expect(within(analyse).getByText("1 van 2 (50%)")).toBeInTheDocument();
    expect(within(analyse).getByText(/te weinig werken/)).toBeInTheDocument();

    const grades = screen.getByRole("table", { name: "Cijfer per werk" });
    expect(within(grades).getByRole("rowheader", { name: "A1" })).toBeInTheDocument();
    expect(within(grades).getByRole("rowheader", { name: "A2" })).toBeInTheDocument();

    expect(screen.getByText(/Alleen bij beoordelaar 1: A3/)).toBeInTheDocument();
    expect(screen.getByText(/Alleen bij beoordelaar 2: A4/)).toBeInTheDocument();

    const agenda = screen.getByRole("heading", { name: "Agenda voor het gesprek" });
    expect(agenda).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Agenda voor het gesprek" })).toHaveTextContent(
      "Analyse",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("names a level the rubric does not have, with the line", async () => {
    const user = userEvent.setup();
    renderCalibrate();
    const group = await paste(user, 1, "A1\tPrima\tAanwezig");
    expect(within(group).getByText(/Regel 1.*Analyse.*Prima/)).toBeInTheDocument();
  });

  it("can be filled in per work in a table", async () => {
    const user = userEvent.setup();
    const { rubric } = renderCalibrate();
    for (const n of [1, 2] as const) {
      const group = await screen.findByRole("group", { name: `Beoordelaar ${n}` });
      await user.click(within(group).getByRole("button", { name: "Werk toevoegen" }));
      await user.type(within(group).getByLabelText("Code van werk 1"), "B7");
      await user.selectOptions(
        within(group).getByLabelText("Analyse, werk 1"),
        rubric.data.criteria[0]!.levels[2]!.id,
      );
    }
    const perCriterion = screen.getByRole("table", { name: "Overeenstemming per criterium" });
    expect(
      within(within(perCriterion).getByRole("row", { name: /Analyse/ })).getByText(
        "1 van 1 (100%)",
      ),
    ).toBeInTheDocument();
  });

  it("moves focus to the code of a new work, so the keyboard can go on", async () => {
    const user = userEvent.setup();
    renderCalibrate();
    const group = await screen.findByRole("group", { name: "Beoordelaar 1" });
    await user.click(within(group).getByRole("button", { name: "Werk toevoegen" }));
    await user.click(within(group).getByRole("button", { name: "Werk toevoegen" }));
    expect(within(group).getByLabelText("Code van werk 2")).toHaveFocus();
  });

  it("speaks English", async () => {
    renderCalibrate("en");
    expect(await screen.findByRole("group", { name: "Rater 1" })).toBeInTheDocument();
    expect(
      screen.getByText("None of this is kept. Close this page and it is gone."),
    ).toBeInTheDocument();
  });

  it("has no axe violations, empty and with a result", async () => {
    const user = userEvent.setup();
    const { container } = renderCalibrate();
    await screen.findByRole("group", { name: "Beoordelaar 1" });
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    await paste(user, 1, "A1\tGoed\tAanwezig\nA2\tPrima\tAanwezig");
    await paste(user, 2, "A1\tVoldoende\tAanwezig");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});

describe("the rubric page", () => {
  it("has a Kalibreren button that opens the calibrate page", async () => {
    const rubric = { id: "r9", name: "Eindwerk", data: sampleRubric() };
    const Page = RubricPage as unknown as (p: { loaderData: unknown }) => React.ReactNode;
    const Stub = createRoutesStub([
      {
        id: "root",
        path: "/",
        loader: () => ({ locale: "nl" }),
        Component: () => (
          <ToastProvider>
            <Page loaderData={{ rubric, insight: null, scoreCount: 0 }} />
          </ToastProvider>
        ),
      },
    ]);
    render(<Stub initialEntries={["/"]} />);
    expect(await screen.findByRole("link", { name: "Kalibreren" })).toHaveAttribute(
      "href",
      "/utilities/rubric/r9/calibrate",
    );
  });
});
