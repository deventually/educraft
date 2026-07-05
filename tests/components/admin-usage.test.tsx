import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminUsage from "~/routes/admin.usage";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const loaderData = {
  rows: [
    { userId: "u1", userName: "Jan", day: "2026-07-04", requests: 3, outputChars: 1200 },
    { userId: "u2", userName: "Kim", day: "2026-07-04", requests: 1, outputChars: 400 },
  ],
  perTool: [{ slug: "mentorai", name: { nl: "MentorAI", en: "MentorAI" }, count: 4 }],
};

const emptyData = { rows: [], perTool: [] };

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
    expect(screen.getByText("MentorAI")).toBeInTheDocument();
  });

  it("shows an empty state with no usage", () => {
    renderRoute(emptyData);
    expect(screen.getByText(/nog geen gebruik|no usage/i)).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = renderRoute();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
