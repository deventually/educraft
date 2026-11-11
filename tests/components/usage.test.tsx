import { describe, expect, it } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import Usage from "~/routes/usage";
import { getToolBySlug } from "~/lib/registry";
import { loc } from "~/lib/i18n/localized";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const tool = getToolBySlug("mentorai")!;
const toolName = loc(tool.name, "nl");

const sums = (calls: number, costMicros = 0) => ({
  calls,
  failedCalls: 0,
  unmeteredCalls: 0,
  inputTokens: calls * 1_000,
  cacheReadTokens: calls * 3_000,
  cacheWriteTokens: 0,
  outputTokens: calls * 500,
  reasoningTokens: 0,
  costMicros,
  unpricedCalls: 0,
});

const weeks = [
  { week: "2026-11-02", calls: 4 },
  { week: "2026-11-09", calls: 2 },
];

const teacher = {
  month: "2026-11",
  months: ["2026-11", "2026-10"],
  own: {
    calls: 6,
    failedCalls: 0,
    weeks,
    sources: [
      { key: tool.slug, calls: 5 },
      { key: "agent-review", calls: 1 },
    ],
    models: [{ key: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", calls: 6 }],
    quota: { used: 12, limit: 50 },
  },
  teams: [],
  instance: null,
  money: null,
};

const team = (activeMembers: number) => ({
  id: "t1",
  name: "Informatica",
  activeMembers,
  calls: 20,
  weeks,
  sources: activeMembers >= 3 ? [{ key: tool.slug, calls: 20 }] : [],
  models: [],
});

const instance = {
  total: { ...sums(30, 1_234_000), unpricedCalls: 2 },
  cacheShare: 0.75,
  weeks: weeks.map((w) => ({ ...w, costMicros: 100 })),
  users: [{ key: "u1", label: "Anna de Vries", ...sums(30, 1_234_000) }],
  teams: [{ key: "t1", label: "Informatica", ...sums(20, 800_000) }],
  sources: [{ key: tool.slug, label: null, ...sums(30, 1_234_000) }],
  models: [
    {
      key: "claude-sonnet-5-5",
      label: "anthropic",
      name: "Claude Sonnet 5.5",
      ...sums(30, 1_234_000),
    },
  ],
  providers: [{ key: "anthropic", label: null, ...sums(30, 1_234_000) }],
};

function renderPage(data: unknown) {
  const props = { loaderData: data } as unknown as ComponentProps<typeof Usage>;
  const Stub = createRoutesStub([{ path: "/usage", Component: () => <Usage {...props} /> }]);
  return render(<Stub initialEntries={["/usage"]} />);
}

describe("Usage page", () => {
  it("shows a teacher their calls, what is left today and their tools, no money", async () => {
    const { container } = renderPage(teacher);
    expect(screen.getByRole("heading", { level: 1, name: "Gebruik" })).toBeInTheDocument();
    expect(screen.getByText("38 van 50")).toBeInTheDocument();
    const tools = screen.getByRole("table", { name: "Per tool" });
    expect(within(tools).getByRole("rowheader", { name: toolName })).toBeInTheDocument();
    expect(within(tools).getByRole("rowheader", { name: "Reviewteam" })).toBeInTheDocument();
    expect(screen.queryByText(/€/)).toBeNull();
    expect(screen.queryByRole("heading", { name: "Hele instelling" })).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("picks the month with a plain GET form", () => {
    renderPage(teacher);
    const select = screen.getByRole("combobox", { name: "Maand" });
    expect(select.closest("form")).toHaveAttribute("method", "get");
    expect(within(select).getByRole("option", { name: "november 2026" })).toBeInTheDocument();
  });

  it("shows the weekly trend as a list with numbers", () => {
    renderPage(teacher);
    const trend = screen.getAllByRole("figure")[0]!;
    expect(
      within(trend)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Week van 2 nov4", "Week van 9 nov2"]);
  });

  it("leaves out an empty trend (an admin who uses no AI themselves)", () => {
    renderPage({
      ...teacher,
      own: {
        ...teacher.own,
        calls: 0,
        sources: [],
        models: [],
        weeks: weeks.map((w) => ({ ...w, calls: 0 })),
      },
    });
    expect(screen.queryByRole("figure")).toBeNull();
    expect(screen.getByText("Deze maand nog geen gebruik.")).toBeInTheDocument();
  });

  it("shows a lead the team's totals, and only the total for a small team", async () => {
    const { container, unmount } = renderPage({ ...teacher, teams: [team(4)] });
    const section = screen.getByRole("region", { name: "Team Informatica" });
    expect(within(section).getByRole("table", { name: "Per tool" })).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    unmount();

    renderPage({ ...teacher, teams: [team(2)] });
    const small = screen.getByRole("region", { name: "Team Informatica" });
    expect(within(small).queryByRole("table")).toBeNull();
    expect(within(small).getByText(/niemand herleidbaar/)).toBeInTheDocument();
  });

  it("shows an admin everyone with costs and the unpriced calls, no forecast", async () => {
    const { container } = renderPage({
      ...teacher,
      own: { ...teacher.own, quota: null },
      instance,
    });
    expect(screen.getByText("Geen daglimiet")).toBeInTheDocument();
    const all = screen.getByRole("region", { name: "Hele instelling" });
    const cost = within(all).getByText("Kosten deze maand").closest("div")!;
    expect(cost).toHaveTextContent("€ 1,23");
    expect(within(all).getByText(/Van 2 aanroepen is de prijs onbekend/)).toBeInTheDocument();
    expect(within(all).getByText("75%")).toBeInTheDocument();
    const people = within(all).getByRole("table", { name: "Per persoon" });
    expect(within(people).getByRole("rowheader", { name: "Anna de Vries" })).toBeInTheDocument();
    expect(screen.queryByText("Prognose voor de hele maand")).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("says 'one call' for a single unpriced call, and rounds a total to cents", () => {
    renderPage({
      ...teacher,
      instance: {
        ...instance,
        total: { ...instance.total, unpricedCalls: 1, costMicros: 624_100 },
      },
    });
    expect(screen.getByText(/Van 1 aanroep is de prijs onbekend/)).toBeInTheDocument();
    const cost = screen.getByText("Kosten deze maand").closest("div")!;
    expect(cost).toHaveTextContent("€ 0,62");
    expect(cost).not.toHaveTextContent("0,6241");
  });

  it("shows the owner the forecast and what caching saved", async () => {
    const { container } = renderPage({
      ...teacher,
      instance,
      money: { currentMonth: true, forecastMicros: 3_100_000, savingsMicros: 450_000 },
    });
    const owner = screen.getByRole("region", { name: "Kosten en prognose" });
    expect(within(owner).getByText("Prognose voor de hele maand")).toBeInTheDocument();
    expect(within(owner).getByText(/3,10/)).toBeInTheDocument();
    expect(within(owner).getByText("Bespaard door caching")).toBeInTheDocument();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("warns a teacher from 80% of the month's limit, as a share without euros", async () => {
    const { container } = renderPage({
      ...teacher,
      own: {
        ...teacher.own,
        limit: { scope: "team", teamName: "Informatica", share: 0.85, state: "warn" },
      },
    });
    expect(screen.getByText("AI-ruimte deze maand").closest("div")).toHaveTextContent("85%");
    expect(
      screen.getByText(
        /Je hebt 85% van je AI-ruimte voor deze maand gebruikt \(de limiet van team Informatica\)/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/€/)).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("says the AI stops when the limit is spent", () => {
    renderPage({
      ...teacher,
      own: { ...teacher.own, limit: { scope: "budget", share: 1.2, state: "stop" } },
    });
    expect(
      screen.getByText(/Je AI-ruimte voor deze maand is op \(het budget van de instelling\)/),
    ).toBeInTheDocument();
  });

  it("lets an admin set limits per team and teacher, and the owner the budget", async () => {
    const limits = {
      budget: { euros: 250 },
      teams: [{ id: "t1", name: "Informatica", euros: 40 }],
      people: [{ id: "u1", name: "Anna de Vries", euros: null }],
    };
    const { container } = renderPage({ ...teacher, instance, limits });
    const region = screen.getByRole("region", { name: "Limieten per maand" });
    expect(within(region).getByLabelText("Budget van de instelling per maand (euro)")).toHaveValue(
      "250",
    );
    expect(within(region).getByLabelText("Limiet per maand voor Informatica (euro)")).toHaveValue(
      "40",
    );
    expect(within(region).getByLabelText("Limiet per maand voor Anna de Vries (euro)")).toHaveValue(
      "",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("hides the budget field from an admin who is not the owner", () => {
    renderPage({ ...teacher, instance, limits: { budget: null, teams: [], people: [] } });
    expect(screen.queryByLabelText(/Budget van de instelling/)).toBeNull();
  });
});
