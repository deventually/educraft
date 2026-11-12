import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { axe } from "vitest-axe";
import { LinkedWorkSection } from "~/components/courses/LinkedWorkSection";
import { emptyCourseData } from "~/lib/courses/schema";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function show() {
  const work = [
    {
      generationId: "g1",
      toolName: { nl: "Les voorbereiden", en: "Prepare a lesson" },
      itemTitle: null,
      createdAt: "2026-11-12T10:00:00Z",
    },
  ];
  const Stub = createRoutesStub([
    {
      path: "/courses/c1",
      Component: () => <LinkedWorkSection work={work} data={emptyCourseData()} />,
    },
  ]);
  return render(<Stub initialEntries={["/courses/c1"]} />);
}

describe("LinkedWorkSection", () => {
  it("offers to add a lesson plan as a lesson, with a title", async () => {
    const work = [
      {
        generationId: "g1",
        toolName: { nl: "Les voorbereiden", en: "Prepare a lesson" },
        itemTitle: null,
        createdAt: "2026-11-12T10:00:00Z",
        asLesson: true,
      },
      {
        generationId: "g2",
        toolName: "Rubric maken",
        itemTitle: null,
        createdAt: "2026-11-12T10:00:00Z",
      },
    ];
    const Stub = createRoutesStub([
      {
        path: "/courses/c1",
        Component: () => <LinkedWorkSection work={work} data={emptyCourseData()} />,
      },
    ]);
    const { container } = render(<Stub initialEntries={["/courses/c1"]} />);
    const buttons = screen.getAllByRole("button", { name: "Neem op als les" });
    expect(buttons).toHaveLength(1);
    const form = buttons[0]?.closest("form");
    expect(form?.querySelector('input[name="intent"]')).toHaveValue("addAsLesson");
    expect(form?.querySelector('input[name="id"]')).toHaveValue("g1");
    expect(screen.getByRole("textbox", { name: "Titel van de les" })).toBeRequired();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("is the anchor a kept result links to", () => {
    show();
    const section = screen.getByRole("region", { name: "Gekoppeld werk" });
    expect(section).toHaveAttribute("id", "linked-work");
    expect(screen.getByText("Les voorbereiden")).toBeTruthy();
  });

  it("has no axe violations", async () => {
    const { container } = show();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
