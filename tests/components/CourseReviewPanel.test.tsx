import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import {
  CourseReviewPanel,
  type ReviewPanelAgent,
  type ReviewPanelChoice,
} from "~/components/courses/CourseReviewPanel";
import { alignedCourse, LO1, TEST1 } from "../courses/fixtures";
import type { CourseTools } from "~/lib/registry/courseActions";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const models = [
  { id: "claude-sonnet-5-5", displayName: "Sonnet 5.5" },
  { id: "claude-opus-5-5", displayName: "Opus 5.5" },
];

const notYet: ReviewPanelAgent[] = [
  {
    agentId: "assessment-expert",
    role: { nl: "Toetsdeskundige", en: "Assessment expert" },
    review: null,
  },
  { agentId: "designer", role: { nl: "Ontwerper", en: "Designer" }, review: null },
];

const FOCUS = {
  "assessment-expert": { nl: "Kijkt of je toetsen meten wat je leeruitkomsten beloven.", en: "a" },
  designer: { nl: "Kijkt of je lessen studenten naar de leeruitkomsten brengen.", en: "b" },
};

/** The hats the admin has on, ticked when the panel shows them. */
function choicesFor(agents: ReviewPanelAgent[], all = notYet): ReviewPanelChoice[] {
  return all.map((a) => ({
    agentId: a.agentId,
    role: a.role,
    focus: FOCUS[a.agentId as keyof typeof FOCUS],
    chosen: agents.some((x) => x.agentId === a.agentId),
  }));
}

function reviewed(stale = false): ReviewPanelAgent[] {
  return [
    {
      ...notYet[0]!,
      review: {
        id: "rev-1",
        model: "Opus 5.5",
        stale,
        findings: [
          {
            id: "f1",
            severity: "warning",
            targetId: LO1,
            message: "De leeruitkomst is vaag.",
            suggestion: "Maak hem toetsbaar.",
          },
          {
            id: "f2",
            severity: "info",
            targetId: TEST1,
            message: "Weging ontbreekt.",
            suggestion: "",
            decision: "rejected",
            reason: "Bewuste keuze.",
          },
        ],
      },
    },
    { ...notYet[1]!, review: { id: "rev-2", model: "Opus 5.5", stale, findings: [] } },
  ];
}

const tools: CourseTools = {
  outcome: [{ slug: "bloom-by-design", name: { nl: "Onderwijstechnologie kiezen", en: "Choose" } }],
  activity: [],
  assessment: [{ slug: "test-items", name: { nl: "Toetsvragen maken", en: "Write" } }],
  findings: {},
};

function renderPanel(
  agents: ReviewPanelAgent[],
  linkedTests = 0,
  withTools?: CourseTools,
  choices = choicesFor(agents),
) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <CourseReviewPanel
          data={alignedCourse()}
          agents={agents}
          choices={choices}
          models={models}
          defaultModel="claude-sonnet-5-5"
          linkedTests={linkedTests}
          courseId="c1"
          tools={withTools}
        />
      ),
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("CourseReviewPanel", () => {
  it("names the hats that are on in its intro (an admin can switch one off)", () => {
    renderPanel(notYet);
    expect(
      screen.getByText(/je reviewteam kijkt je cursus na: toetsdeskundige en ontwerper\./i),
    ).toBeVisible();
  });

  it("names a single hat when only one is on", () => {
    // The admin switched the assessment expert off: it is neither run nor offered.
    renderPanel([notYet[1]!], 0, undefined, choicesFor([notYet[1]!], [notYet[1]!]));
    expect(screen.getByText(/kijkt je cursus na: ontwerper\./i)).toBeVisible();
    expect(screen.queryByText(/toetsdeskundige/i)).toBeNull();
  });

  it("offers the review with a model choice and says nothing was reviewed yet", async () => {
    const { container } = renderPanel(notYet);
    expect(screen.getByRole("heading", { name: "Reviewteam" })).toBeVisible();
    expect(screen.getByLabelText("Model")).toHaveValue("claude-sonnet-5-5");
    const run = screen.getByRole("button", { name: "Laat reviewen" });
    expect(run).toHaveAttribute("name", "intent");
    expect(run).toHaveAttribute("value", "review");
    expect(screen.getAllByText("Nog niet gereviewd.")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Toetsdeskundige" })).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows open findings with the item they are about and Akkoord / Niet akkoord", async () => {
    const { container } = renderPanel(reviewed());
    const open = screen.getByText("De leeruitkomst is vaag.").closest("li") as HTMLElement;
    expect(within(open).getByText(/Je ontwerpt een datamodel\./)).toBeVisible();
    expect(within(open).getByText(/Maak hem toetsbaar\./)).toBeVisible();
    expect(within(open).getByLabelText("Reden (optioneel)")).toHaveAttribute("maxLength", "500");
    const accept = within(open).getByRole("button", { name: /^Akkoord/ });
    expect(accept).toHaveAttribute("name", "decision");
    expect(accept).toHaveAttribute("value", "accepted");
    expect(within(open).getByRole("button", { name: /^Niet akkoord/ })).toHaveAttribute(
      "value",
      "rejected",
    );
    const form = accept.closest("form") as HTMLFormElement;
    expect(form.querySelector('input[name="intent"]')).toHaveValue("decide");
    expect(form.querySelector('input[name="reviewId"]')).toHaveValue("rev-1");
    expect(form.querySelector('input[name="findingId"]')).toHaveValue("f1");
    expect(screen.getByText("Geen adviezen van deze reviewer.")).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("folds decided findings away with the decision and the reason", () => {
    renderPanel(reviewed());
    const summary = screen.getByText("Afgehandeld (1)");
    const details = summary.closest("details") as HTMLElement;
    expect(details).not.toHaveAttribute("open");
    expect(within(details).getByText("Weging ontbreekt.")).toBeInTheDocument();
    expect(within(details).getByText(/Niet akkoord/)).toBeInTheDocument();
    expect(within(details).getByText(/Bewuste keuze\./)).toBeInTheDocument();
    expect(within(details).queryByRole("button")).toBeNull();
  });

  it("says when the course changed after the review", async () => {
    const { container } = renderPanel(reviewed(true));
    expect(screen.getAllByText(/gewijzigd na deze review/)).toHaveLength(2);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("offers to review linked test questions too, off by default, only when there are any (P21.7)", async () => {
    const { container } = renderPanel(notYet, 2);
    const box = screen.getByRole("checkbox", { name: /Ook de gekoppelde toetsvragen nakijken/ });
    expect(box).not.toBeChecked();
    expect(box).toHaveAttribute("name", "includeLinked");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("hides the box without linked test questions", () => {
    renderPanel(notYet, 0);
    expect(screen.queryByRole("checkbox", { name: /gekoppelde toetsvragen/ })).toBeNull();
  });

  it("lets the teacher tick which hats review, each with what it looks at", async () => {
    const { container } = renderPanel([notYet[1]!]);
    const group = screen.getByRole("group", { name: "Wie zit in je reviewteam?" });
    const assessment = within(group).getByRole("checkbox", { name: /Toetsdeskundige/ });
    expect(assessment).not.toBeChecked();
    expect(assessment).toHaveAttribute("name", "agent");
    expect(assessment).toHaveAttribute("value", "assessment-expert");
    expect(within(group).getByRole("checkbox", { name: /Ontwerper/ })).toBeChecked();
    expect(within(group).getByText(FOCUS.designer.nl)).toBeVisible();
    const form = assessment.closest("form") as HTMLFormElement;
    expect(form.querySelector('input[name="agentsChosen"]')).toHaveValue("1");
    expect(within(group).getByRole("link", { name: /Meer over het reviewteam/ })).toHaveAttribute(
      "href",
      "/help/review-team",
    );
    // Only the chosen hat has a review section.
    expect(screen.queryByRole("heading", { name: "Toetsdeskundige" })).toBeNull();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("turns the review off and says why while no hat is ticked", async () => {
    const { container } = renderPanel([]);
    const run = screen.getByRole("button", { name: "Laat reviewen" });
    expect(run).toBeDisabled();
    expect(screen.getByText("Kies minstens één reviewer om te laten reviewen.")).toBeVisible();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
    fireEvent.click(screen.getByRole("checkbox", { name: /Ontwerper/ }));
    expect(run).toBeEnabled();
  });

  it("offers Los op met… for an open finding about an item (P27.4)", async () => {
    const agents = reviewed();
    const review = agents[0]!.review;
    if (!review) throw new Error("fixture");
    review.findings.push({
      id: "f3",
      severity: "warning",
      targetId: TEST1,
      message: "Te weinig vragen.",
      suggestion: "",
    });
    const { container } = renderPanel(agents, 0, tools);
    const outcome = screen.getByText("De leeruitkomst is vaag.").closest("li") as HTMLElement;
    expect(
      within(outcome).getByRole("link", { name: /Los op met Onderwijstechnologie kiezen/ }),
    ).toHaveAttribute("href", "/tools/bloom-by-design?course=c1");
    const test = screen.getByText("Te weinig vragen.").closest("li") as HTMLElement;
    expect(
      within(test).getByRole("link", { name: /Los op met Toetsvragen maken/ }),
    ).toHaveAttribute("href", `/tools/test-items?course=c1&item=${TEST1}`);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("offers no tool without tools (P27.4)", () => {
    renderPanel(reviewed());
    expect(screen.queryByRole("link", { name: /Los op met/ })).toBeNull();
  });
});
