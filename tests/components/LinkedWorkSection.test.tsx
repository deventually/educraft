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
