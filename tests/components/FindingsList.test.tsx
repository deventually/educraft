import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { FindingsList } from "~/components/courses/FindingsList";
import type { AlignmentFinding } from "~/lib/courses/alignment";
import type { CourseTools } from "~/lib/registry/courseActions";
import { alignedCourse, LO1, QUIZ } from "../courses/fixtures";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const testItems = {
  slug: "test-items",
  name: { nl: "Toetsvragen maken", en: "Write test questions" },
};
const tools: CourseTools = {
  outcome: [],
  activity: [],
  assessment: [],
  findings: { "outcome-not-assessed": testItems, "bloom-below-outcome": testItems },
};

const findings: AlignmentFinding[] = [
  { code: "outcome-not-assessed", severity: "warning", outcomeId: LO1 },
  { code: "bloom-below-outcome", severity: "warning", outcomeId: LO1, itemId: QUIZ },
  { code: "weights-not-100", severity: "info" },
];

function renderList(withTools?: CourseTools, list = findings, data = alignedCourse()) {
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      loader: () => ({ locale: "nl", user: null }),
      Component: () => <FindingsList data={data} findings={list} courseId="c1" tools={withTools} />,
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("FindingsList — Los op met… (P27.4)", () => {
  it("offers the tool for a finding, with the course and the item it is about", async () => {
    renderList(tools);
    const links = await screen.findAllByRole("link", { name: /Los op met Toetsvragen maken/ });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/tools/test-items?course=c1");
    expect(links[1]).toHaveAttribute("href", `/tools/test-items?course=c1&item=${QUIZ}`);
  });

  it("offers nothing for a finding without a tool, or without tools at all", async () => {
    renderList();
    await screen.findByText(/summatieve toetsen/);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("has no a11y violations", async () => {
    const { container } = renderList(tools);
    await screen.findAllByRole("link");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("names each discipline that serves no outcome, once", async () => {
    const data = alignedCourse();
    data.disciplines = [
      { id: "web", name: "Webtech" },
      { id: "hw", name: "Hardware" },
    ];
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    renderList(
      undefined,
      [
        { code: "discipline-without-outcome", severity: "warning", disciplineId: "web" },
        { code: "discipline-without-outcome", severity: "warning", disciplineId: "hw" },
      ],
      data,
    );
    expect(await screen.findByText(/De discipline Webtech draagt/)).toBeInTheDocument();
    expect(screen.getByText(/De discipline Hardware draagt/)).toBeInTheDocument();
    expect(error.mock.calls.flat().join(" ")).not.toMatch(/same key/);
    error.mockRestore();
  });
});
