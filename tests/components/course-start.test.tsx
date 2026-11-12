import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { expectAiCallId } from "../helpers/aiCall";
import { CourseStart } from "~/components/courses/CourseStart";
import type { ImportProposal } from "~/lib/courses/import";
import { emptyCourseData } from "~/lib/courses/schema";
import type { CourseData } from "~/lib/courses/types";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

function renderStart(
  opts: {
    proposal?: ImportProposal | null;
    notes?: string;
    design?: boolean;
    data?: CourseData;
  } = {},
) {
  const Stub = createRoutesStub([
    {
      path: "/courses/:id",
      Component: () => (
        <CourseStart
          courseId="c1"
          data={opts.data ?? emptyCourseData()}
          design={opts.design ?? true}
          proposal={opts.proposal ?? null}
          notes={opts.notes}
        />
      ),
    },
  ]);
  return render(<Stub initialEntries={["/courses/c1"]} />);
}

const proposal: ImportProposal = {
  source: "design",
  outcomes: [
    {
      key: "o1",
      text: "De student ontwerpt een datamodel.",
      bloom: "create",
      verbatim: false,
      existing: false,
      criteria: [{ text: "Elke tabel heeft een sleutel.", verbatim: false }],
    },
  ],
  assessments: [],
  notes: "Ik ging uit van hbo, jaar 1.",
  weightsOff: false,
};

describe("CourseStart", () => {
  it("offers three ways to start an empty course", async () => {
    const { container } = renderStart();
    const section = screen.getByRole("region", { name: "Hoe wil je beginnen?" });
    expect(within(section).getByText("In grote lijnen ontwerpen")).toBeTruthy();
    expect(
      within(section).getByRole("link", { name: "Naar importeren" }).getAttribute("href"),
    ).toBe("#course-import");
    expect(
      within(section).getByRole("link", { name: "Naar leeruitkomsten" }).getAttribute("href"),
    ).toBe("/courses/c1?tab=outcomes");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("asks for a description, the EC and the weeks, filled in from the course", async () => {
    renderStart({
      data: { ...emptyCourseData(), ec: 5, schedule: { weeks: 8 }, description: "Over databases." },
    });
    const description = screen.getByLabelText("Waar gaat de cursus over?") as HTMLTextAreaElement;
    expect(description.required).toBe(true);
    expect(description.value).toBe("Over databases.");
    expect((screen.getByLabelText("Studielast (EC)") as HTMLInputElement).value).toBe("5");
    expect((screen.getByLabelText("Aantal weken") as HTMLInputElement).value).toBe("8");
    const submit = screen.getByRole("button", { name: "Leeruitkomsten voorstellen" });
    const form = submit.closest("form")!;
    expect((form.querySelector('input[name="intent"]') as HTMLInputElement).value).toBe(
      "design-outcomes",
    );
    await expectAiCallId(submit);
  });

  it("leaves out the design choice when the wizard is switched off", () => {
    renderStart({ design: false });
    expect(screen.queryByText("In grote lijnen ontwerpen")).toBeNull();
    expect(screen.queryByRole("button", { name: "Leeruitkomsten voorstellen" })).toBeNull();
    expect(screen.getByRole("link", { name: "Naar importeren" })).toBeTruthy();
  });

  it("shows the AI proposal ticked, without the 'not in the document' warning", async () => {
    const { container } = renderStart({ proposal });
    const form = screen.getByRole("form", { name: "AI-voorstel" });
    expect(within(form).getByText(/De AI maakte dit voorstel/)).toBeTruthy();
    expect(within(form).getByText("Ik ging uit van hbo, jaar 1.")).toBeTruthy();
    expect(
      (within(form).getByRole("checkbox", { name: "Toevoegen aan de cursus" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(within(form).queryByText(/niet letterlijk/)).toBeNull();
    expect(within(form).getByText("Elke tabel heeft een sleutel.")).toBeTruthy();
    expect((form.querySelector('input[name="intent"]') as HTMLInputElement).value).toBe(
      "import-apply",
    );
    // Applied from the wizard: the next step's proposal comes right after.
    expect((form.querySelector('input[name="wizard"]') as HTMLInputElement).value).toBe("on");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows what the AI still needs when it proposed nothing", () => {
    renderStart({ notes: "Wat moeten studenten kunnen?" });
    const box = screen.getByRole("region", { name: "Opmerkingen van de AI" });
    expect(within(box).getByText("Wat moeten studenten kunnen?")).toBeTruthy();
    // The design form stays open, so the teacher can add to the description.
    expect(screen.getByLabelText("Waar gaat de cursus over?")).toBeTruthy();
  });
});
