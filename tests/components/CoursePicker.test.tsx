import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

vi.mock("~/lib/i18n/useT", () => ({
  useLocale: () => "en",
  useT: () => ({
    tool: {
      course: "Course",
      noCourse: "No course",
      courseHint: "Fills in its learning outcomes and links the result to it.",
    },
  }),
}));

import { CoursePicker } from "~/components/CoursePicker";

const courses = [
  { id: "c1", name: "Biology 4 havo" },
  { id: "c2", name: "Chemistry 5 vwo" },
];
const axeOpts = { rules: { "color-contrast": { enabled: false } } };

describe("CoursePicker (P20, 20.4)", () => {
  it("renders nothing without courses", () => {
    const { container } = render(<CoursePicker courses={[]} value="" onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offers the courses, explains itself and reports the choice", async () => {
    const onChange = vi.fn();
    render(<CoursePicker courses={courses} value="" onChange={onChange} />);
    const select = screen.getByRole("combobox", { name: "Course" });
    expect(select).toHaveAccessibleDescription(/links the result/);
    expect(screen.getByRole("option", { name: "No course" })).toBeTruthy();
    await userEvent.selectOptions(select, "c2");
    expect(onChange).toHaveBeenCalledWith("c2");
  });

  it("has no axe violations", async () => {
    const { container } = render(<CoursePicker courses={courses} value="c1" onChange={vi.fn()} />);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
