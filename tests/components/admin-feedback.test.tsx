import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminFeedback from "~/routes/admin.feedback";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const loaderData = {
  rows: [
    {
      id: "f1",
      rating: 1,
      comment: "Sterk resultaat",
      createdAt: new Date("2026-07-01T10:00:00Z"),
      userName: "Jan",
      toolSlug: "mentorai",
      toolName: { nl: "MentorAI", en: "MentorAI" },
    },
    {
      id: "f2",
      rating: -1,
      comment: null,
      createdAt: new Date("2026-07-02T10:00:00Z"),
      userName: "Kim",
      toolSlug: "bloom-by-design",
      toolName: { nl: "Bloom by Design", en: "Bloom by Design" },
    },
  ],
};

function renderRoute() {
  const props = { loaderData } as unknown as ComponentProps<typeof AdminFeedback>;
  const Stub = createRoutesStub([
    { path: "/admin/feedback", Component: () => <AdminFeedback {...props} /> },
  ]);
  return render(<Stub initialEntries={["/admin/feedback"]} />);
}

describe("Admin feedback", () => {
  it("renders each feedback row with its tool and rater", () => {
    renderRoute();
    // The tool name appears in the row and in the filter option, so assert ≥ 1.
    expect(screen.getAllByText("MentorAI").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bloom by Design").length).toBeGreaterThan(0);
    expect(screen.getByText("Jan")).toBeInTheDocument();
    expect(screen.getByText("Kim")).toBeInTheDocument();
  });

  it("filters the list by tool (mutation on the client)", async () => {
    const user = userEvent.setup();
    renderRoute();
    await user.selectOptions(screen.getByRole("combobox"), "bloom-by-design");
    expect(screen.queryByText("Jan")).toBeNull();
    expect(screen.getByText("Kim")).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = renderRoute();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
