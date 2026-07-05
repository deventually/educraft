import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import AdminTools from "~/routes/admin.tools";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const loaderData = {
  rows: [
    {
      slug: "mentorai",
      name: { nl: "MentorAI", en: "MentorAI" },
      userType: "student" as const,
      mode: "chat" as const,
      phase: 1 as const,
      enabled: true,
      audienceOverride: "",
    },
    {
      slug: "bloom-by-design",
      name: { nl: "Bloom by Design", en: "Bloom by Design" },
      userType: "instructor" as const,
      mode: "chat" as const,
      phase: 3 as const,
      enabled: false,
      audienceOverride: "both",
    },
  ],
};

function renderRoute(action?: () => unknown) {
  const props = { loaderData } as unknown as ComponentProps<typeof AdminTools>;
  const Stub = createRoutesStub([
    {
      path: "/admin/tools",
      Component: () => <AdminTools {...props} />,
      action: action ?? (() => ({ savedSlug: "mentorai", enabled: false })),
    },
  ]);
  return render(<Stub initialEntries={["/admin/tools"]} />);
}

describe("Admin tools", () => {
  it("lists every registry tool with an enabled toggle and audience select", () => {
    renderRoute();
    expect(screen.getByText("MentorAI")).toBeInTheDocument();
    expect(screen.getByText("Bloom by Design")).toBeInTheDocument();
    // One enabled checkbox per tool.
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    // One audience select per tool.
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
  });

  it("confirms a save (mutation) via the per-row form", async () => {
    const user = userEvent.setup();
    renderRoute();
    const [firstSave] = screen.getAllByRole("button", { name: /opslaan|save/i });
    await user.click(firstSave);
    await waitFor(() => {
      expect(screen.getByText(/opgeslagen|saved/i)).toBeInTheDocument();
    });
  });

  it("has no a11y violations", async () => {
    const { container } = renderRoute();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
