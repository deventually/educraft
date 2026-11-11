import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import AdminUsage from "~/routes/admin.usage";
import { getToolBySlug } from "~/lib/registry";
import { loc } from "~/lib/i18n/localized";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

// Tool names come from the registry, never from hardcoded titles (P19.1 renamed them).
const first = getToolBySlug("mentorai")!;
const second = getToolBySlug("bloom-by-design")!;
const firstName = loc(first.name, "nl");
const secondName = loc(second.name, "nl");

const feedback = [
  {
    id: "f1",
    rating: 1,
    comment: "Sterk resultaat",
    createdAt: new Date("2026-07-01T10:00:00Z"),
    userName: "Anna",
    toolSlug: first.slug,
    toolName: first.name,
    minutesSaved: 60,
    quality: 5,
  },
  {
    id: "f2",
    rating: -1,
    comment: null,
    createdAt: new Date("2026-07-02T10:00:00Z"),
    userName: "Piet",
    toolSlug: second.slug,
    toolName: second.name,
    minutesSaved: null,
    quality: null,
  },
];

const loaderData = {
  feedback,
  teams: [
    { id: "t-hsl", name: "HSL" },
    { id: "t-hhs", name: "HHS" },
  ],
  teamId: "",
  pilot: [
    {
      toolSlug: first.slug,
      name: first.name,
      uses: 7,
      up: 2,
      down: 1,
      minutesSaved: 90,
      timeAnswers: 3,
      qualityAvg: 4.5,
      qualityAnswers: 2,
      comments: 2,
    },
  ],
  checkins: [
    {
      id: "c1",
      userName: "Anna",
      helped: "De rubric-tool",
      annoyed: null,
      missing: "Voorlezen",
      createdAt: new Date("2026-11-01T10:00:00Z"),
    },
  ],
};

const emptyData = {
  feedback: [],
  teams: [],
  teamId: "",
  pilot: [],
  checkins: [],
};

function renderRoute(data: unknown = loaderData) {
  const props = { loaderData: data } as unknown as ComponentProps<typeof AdminUsage>;
  const Stub = createRoutesStub([
    { path: "/admin/usage", Component: () => <AdminUsage {...props} /> },
  ]);
  return render(<Stub initialEntries={["/admin/usage"]} />);
}

describe("Admin usage", () => {
  it("has two headings: the pilot per tool and tester feedback (AI use moved to /usage)", () => {
    renderRoute();
    const names = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(names).toEqual([
      expect.stringMatching(/^pilot per tool/i),
      expect.stringMatching(/feedback van testers|tester feedback/i),
    ]);
    expect(screen.queryByText("Jan")).toBeNull();
  });

  it("shows the pilot per tool: uses, thumbs, time saved, quality, comments", () => {
    renderRoute();
    const table = screen.getByRole("table", { name: /pilot per tool/i });
    const row = within(table).getByRole("row", { name: new RegExp(firstName) });
    const cells = within(row)
      .getAllByRole("cell")
      .map((c) => c.textContent);
    expect(within(row).getByRole("rowheader")).toHaveTextContent(firstName);
    expect(cells).toEqual([
      "7",
      expect.stringContaining("2"),
      expect.stringContaining("1"),
      "1 u 30 min (3)",
      "4,5 (2)",
      "2",
    ]);
  });

  it("filters the pilot by team with a plain GET form", () => {
    renderRoute();
    const select = screen.getByRole("combobox", { name: "Team" });
    expect(select.closest("form")).toHaveAttribute("method", "get");
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Alle teams", "HSL", "HHS"]);
    expect(screen.getByRole("button", { name: "Toon" })).toBeInTheDocument();
  });

  it("lists what teachers said in the check-in", () => {
    renderRoute();
    expect(screen.getByText("De rubric-tool")).toBeInTheDocument();
    expect(screen.getByText("Voorlezen")).toBeInTheDocument();
  });

  it("shows time saved and quality in the feedback list", () => {
    renderRoute();
    const table = screen.getByRole("table", { name: /feedback van testers/i });
    expect(within(table).getByText("60+ min")).toBeInTheDocument();
    expect(within(table).getByText("5")).toBeInTheDocument();
  });

  it("renders each feedback row with its tool and rater", () => {
    renderRoute();
    expect(screen.getAllByText(secondName).length).toBeGreaterThan(0);
    expect(screen.getByText("Sterk resultaat")).toBeInTheDocument();
    expect(screen.getByText("Piet")).toBeInTheDocument();
  });

  it("filters the feedback by tool (client side)", async () => {
    const user = userEvent.setup();
    renderRoute();
    await user.selectOptions(
      screen.getByRole("combobox", { name: /filter op tool/i }),
      second.slug,
    );
    expect(screen.queryByText("Sterk resultaat")).toBeNull();
    expect(screen.getByText("Piet")).toBeInTheDocument();
  });

  it("shows an empty state with no feedback", () => {
    renderRoute(emptyData);
    expect(screen.getByText(/nog geen feedback|no feedback/i)).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = renderRoute();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
