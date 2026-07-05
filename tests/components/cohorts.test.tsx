import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import CohortForm from "~/routes/cohorts.$id";
import type { InputField } from "~/lib/registry/types";

const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const disciplineField: InputField = {
  name: "discipline",
  label: { nl: "Vakgebied", en: "Discipline" },
  kind: "text",
  required: true,
};

const tutors = [
  { slug: "mentorai", name: { nl: "MentorAI", en: "MentorAI" }, inputs: [disciplineField] },
  {
    slug: "socratic-partner",
    name: { nl: "Socratic Partner", en: "Socratic Partner" },
    inputs: [],
  },
  { slug: "peer-tutoring", name: { nl: "Peer Tutoring", en: "Peer Tutoring" }, inputs: [] },
];

const loaderData = {
  mode: "new" as const,
  tutors,
  profiles: [{ id: "p1", name: "SE jaar 2" }],
  cohort: null,
};

/**
 * Render the form inside the stub's data router (needed for
 * Form/useActionData/useNavigation). loaderData is injected via a wrapper; the
 * action is stubbed to return generated links without touching the DB.
 */
function renderForm(action?: () => unknown) {
  const props = { loaderData } as unknown as ComponentProps<typeof CohortForm>;
  const Stub = createRoutesStub([
    {
      path: "/cohorts/:id",
      Component: () => <CohortForm {...props} />,
      action: action ?? (() => null),
    },
  ]);
  return render(<Stub initialEntries={["/cohorts/new"]} />);
}

describe("Cohort provisioning form", () => {
  it("renders a tutor checkbox per student tool", () => {
    renderForm();
    expect(screen.getAllByRole("checkbox")).toHaveLength(tutors.length);
    expect(screen.getByLabelText("MentorAI")).toBeInTheDocument();
    expect(screen.getByLabelText("Socratic Partner")).toBeInTheDocument();
  });

  it("reveals a tutor's per-tutor config only once it is selected", async () => {
    const user = userEvent.setup();
    renderForm();
    // Hidden until the tutor is checked.
    expect(screen.queryByLabelText(/Vakgebied|Discipline/i)).toBeNull();
    await user.click(screen.getByLabelText("MentorAI"));
    expect(screen.getByLabelText(/Vakgebied|Discipline/i)).toBeInTheDocument();
  });

  it("issues a batch and renders the generated invite links", async () => {
    const user = userEvent.setup();
    renderForm(() => ({
      cohortId: "c1",
      links: [
        { url: "http://localhost/invite/token-a", email: "a@example.com" },
        { url: "http://localhost/invite/token-b", email: null },
      ],
    }));

    await user.click(screen.getByLabelText("MentorAI"));
    await user.type(screen.getByLabelText(/naam|name/i), "SE jaar 2");
    await user.click(screen.getByRole("button", { name: /aanmaken|create/i }));

    // The generated links appear (batch of two: one email-bound, one link-only).
    await waitFor(() => {
      expect(screen.getByText("http://localhost/invite/token-a")).toBeInTheDocument();
    });
    expect(screen.getByText("http://localhost/invite/token-b")).toBeInTheDocument();
    expect(screen.getByText("a@example.com")).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = renderForm();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no a11y violations once a tutor config is expanded", async () => {
    const user = userEvent.setup();
    const { container } = renderForm();
    await user.click(screen.getByLabelText("MentorAI"));
    // The revealed config field is properly labelled.
    within(container).getByLabelText(/Vakgebied|Discipline/i);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
