import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { CourseReviewPanel, type ReviewPanelAgent } from "~/components/courses/CourseReviewPanel";
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

function reviewed(stale = false): ReviewPanelAgent[] {
  return [
    {
      ...notYet[0],
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
    { ...notYet[1], review: { id: "rev-2", model: "Opus 5.5", stale, findings: [] } },
  ];
}

const tools: CourseTools = {
  outcome: [{ slug: "bloom-by-design", name: { nl: "Onderwijstechnologie kiezen", en: "Choose" } }],
  activity: [],
  assessment: [{ slug: "test-items", name: { nl: "Toetsvragen maken", en: "Write" } }],
  findings: {},
};

function renderPanel(agents: ReviewPanelAgent[], linkedTests = 0, withTools?: CourseTools) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <CourseReviewPanel
          data={alignedCourse()}
          agents={agents}
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
      screen.getByText(/kritische collega's kijken je cursus na: toetsdeskundige en ontwerper\./i),
    ).toBeVisible();
  });

  it("names a single hat when only one is on", () => {
    renderPanel([notYet[1]]);
    expect(screen.getByText(/kijken je cursus na: ontwerper\./i)).toBeVisible();
    expect(screen.queryByText(/toetsdeskundige/i)).toBeNull();
  });

  it("offers the review with a model choice and says nothing was reviewed yet", async () => {
    const { container } = renderPanel(notYet);
    expect(screen.getByRole("heading", { name: "Beoordeling" })).toBeVisible();
    expect(screen.getByLabelText("Model")).toHaveValue("claude-sonnet-5-5");
    const run = screen.getByRole("button", { name: "Laat beoordelen" });
    expect(run).toHaveAttribute("name", "intent");
    expect(run).toHaveAttribute("value", "review");
    expect(screen.getAllByText("Nog niet beoordeeld.")).toHaveLength(2);
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
    expect(screen.getByText("Geen adviezen van deze pet.")).toBeVisible();
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
    expect(screen.getAllByText(/gewijzigd na deze beoordeling/)).toHaveLength(2);
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
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("offers Los op met… for an open finding about an item (P27.4)", async () => {
    const agents = reviewed();
    const review = agents[0].review;
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
