import { describe, expect, it } from "vitest";
import { render as rtlRender, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { axe } from "vitest-axe";
import { CourseFacts } from "~/components/portfolio/CourseFacts";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function render(node: React.ReactNode) {
  const Stub = createRoutesStub([{ path: "/", Component: () => <>{node}</> }]);
  return rtlRender(<Stub initialEntries={["/"]} />);
}

const view = {
  courseId: "c1",
  course: "Databases 1",
  facts: [
    { key: "course" as const, value: "Databases 1" },
    { key: "groupSize" as const, value: "24" },
    { key: "lessonGoal" as const, value: "De student normaliseert een tabel." },
  ],
};

describe("CourseFacts", () => {
  it("lists what the course already says, each fact with its label", async () => {
    const { container } = render(<CourseFacts view={view} />);
    const region = screen.getByRole("region", { name: "Uit je cursus" });
    expect(within(region).getByText("Groepsgrootte")).toBeTruthy();
    expect(within(region).getByText("24")).toBeTruthy();
    expect(within(region).getByText("De student normaliseert een tabel.")).toBeTruthy();
    // The course's name is the heading's context, not a fact repeated in the list.
    expect(within(region).queryByText("Cursus")).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("says where to change a fact: in the course, on its overview", () => {
    render(<CourseFacts view={view} />);
    const link = screen.getByRole("link", {
      name: "Klopt iets niet meer? Pas het aan in Databases 1",
    });
    expect(link.getAttribute("href")).toBe("/courses/c1");
  });

  it("shows nothing without facts", () => {
    const { container } = render(<CourseFacts view={null} />);
    expect(container.textContent).toBe("");
  });
});
