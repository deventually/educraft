import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
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
  },
  {
    id: "f2",
    rating: -1,
    comment: null,
    createdAt: new Date("2026-07-02T10:00:00Z"),
    userName: "Piet",
    toolSlug: second.slug,
    toolName: second.name,
  },
];

const loaderData = {
  feedback,
  rows: [
    { userId: "u1", userName: "Jan", day: "2026-07-04", requests: 3, outputChars: 1200 },
    { userId: "u2", userName: "Kim", day: "2026-07-04", requests: 1, outputChars: 400 },
  ],
  perTool: [{ slug: first.slug, name: first.name, count: 4 }],
};

const emptyData = { rows: [], perTool: [], feedback: [] };

function renderRoute(data: unknown = loaderData) {
  const props = { loaderData: data } as unknown as ComponentProps<typeof AdminUsage>;
  const Stub = createRoutesStub([
    { path: "/admin/usage", Component: () => <AdminUsage {...props} /> },
  ]);
  return render(<Stub initialEntries={["/admin/usage"]} />);
}

describe("Admin usage", () => {
  it("renders per-user rows and per-tool totals", () => {
    renderRoute();
    expect(screen.getByText("Jan")).toBeInTheDocument();
    expect(screen.getByText("Kim")).toBeInTheDocument();
    // The per-tool table; the feedback list below repeats the name, so assert >= 1.
    expect(screen.getAllByText(firstName).length).toBeGreaterThan(0);
  });

  it("has two headings: usage and tester feedback", () => {
    renderRoute();
    const names = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(names).toEqual([
      expect.stringMatching(/^gebruik|^usage/i),
      expect.stringMatching(/feedback van testers|tester feedback/i),
    ]);
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
    await user.selectOptions(screen.getByRole("combobox"), second.slug);
    expect(screen.queryByText("Sterk resultaat")).toBeNull();
    expect(screen.getByText("Piet")).toBeInTheDocument();
  });

  it("shows an empty state with no usage and no feedback", () => {
    renderRoute(emptyData);
    expect(screen.getByText(/nog geen gebruik|no usage/i)).toBeInTheDocument();
    expect(screen.getByText(/nog geen feedback|no feedback/i)).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = renderRoute();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
