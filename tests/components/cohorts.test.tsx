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

const modelCatalog = [
  { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5" },
  // P14: a teacher may also offer a local/CLI model to a cohort.
  { id: "claude-code", displayName: "Claude Code (CLI)" },
];

const loaderData = {
  mode: "new" as const,
  tutors,
  profiles: [{ id: "p1", name: "SE jaar 2" }],
  cohort: null,
  models: { catalog: modelCatalog, selected: null },
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

function renderManage(canDelete: boolean, action?: () => unknown) {
  const props = {
    loaderData: {
      mode: "manage" as const,
      canDelete,
      tutors,
      profiles: [{ id: "p1", name: "SE jaar 2" }],
      cohort: {
        id: "c1",
        name: "SE jaar 2",
        allowedToolSlugs: [],
        config: {},
        contextProfileId: null,
        contextEqf: null,
        activeUntil: null,
      },
      // Manage mode: the cohort is restricted to one model (P13).
      models: { catalog: modelCatalog, selected: ["claude-haiku-4-5"] },
    },
  } as unknown as ComponentProps<typeof CohortForm>;
  const Stub = createRoutesStub([
    {
      path: "/cohorts/:id",
      Component: () => <CohortForm {...props} />,
      action: action ?? (() => null),
    },
  ]);
  return render(<Stub initialEntries={["/cohorts/c1"]} />);
}

describe("Cohort provisioning form", () => {
  it("renders a tutor checkbox per student tool", () => {
    renderForm();
    // Scope to the tutors fieldset — the model fieldset adds more checkboxes below.
    const tutorGroup = screen.getByRole("group", { name: /kies de tutors/i });
    expect(within(tutorGroup).getAllByRole("checkbox")).toHaveLength(tutors.length);
    expect(screen.getByLabelText("MentorAI")).toBeInTheDocument();
    expect(screen.getByLabelText("Socratic Partner")).toBeInTheDocument();
  });

  it("renders a model checkbox per selectable model, all checked for a new cohort (P13)", () => {
    renderForm();
    const group = screen.getByRole("group", { name: /modellen voor dit cohort/i });
    expect((within(group).getByLabelText("Claude Sonnet 4.6") as HTMLInputElement).checked).toBe(
      true,
    );
    expect((within(group).getByLabelText("Claude Haiku 4.5") as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("[P14] lists a local/CLI model as a cohort model option", () => {
    renderForm();
    const group = screen.getByRole("group", { name: /modellen voor dit cohort/i });
    expect(within(group).getByLabelText("Claude Code (CLI)")).toBeInTheDocument();
  });

  it("pre-checks only the cohort's selected models in manage mode (P13)", () => {
    renderManage(false);
    const group = screen.getByRole("group", { name: /modellen voor dit cohort/i });
    expect((within(group).getByLabelText("Claude Haiku 4.5") as HTMLInputElement).checked).toBe(
      true,
    );
    expect((within(group).getByLabelText("Claude Sonnet 4.6") as HTMLInputElement).checked).toBe(
      false,
    );
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

  it("offers a context-source choice and hides the EQF selector until chosen", () => {
    renderForm();
    expect(screen.getByRole("radio", { name: /geen niveau|no level/i })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /contextprofiel|context profile/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /alleen eqf|eqf level only/i })).toBeInTheDocument();
    // Neither the profile nor the EQF control is shown while "none" is selected.
    expect(screen.queryByLabelText("EQF-niveau")).toBeNull();
  });

  it("reveals the EQF selector when 'EQF level only' is chosen", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("radio", { name: /alleen eqf|eqf level only/i }));
    expect(screen.getByLabelText("EQF-niveau")).toBeInTheDocument();
  });

  it("shows an admin-only delete on a managed cohort, hidden otherwise", () => {
    renderManage(true);
    expect(
      screen.getByRole("button", { name: /cohort verwijderen|delete cohort/i }),
    ).toBeInTheDocument();
  });

  it("hides cohort delete when the viewer may not delete it", () => {
    renderManage(false);
    expect(screen.queryByRole("button", { name: /cohort verwijderen|delete cohort/i })).toBeNull();
  });

  it("offers a Save changes action that persists tool edits without inviting", async () => {
    const user = userEvent.setup();
    renderManage(false, () => ({ saved: true }));
    // Change the cohort's tutors, then save — no recipients required.
    await user.click(screen.getByLabelText("Peer Tutoring"));
    await user.click(screen.getByRole("button", { name: /wijzigingen opslaan|save changes/i }));
    await waitFor(() =>
      expect(screen.getByText(/wijzigingen opgeslagen|changes saved/i)).toBeInTheDocument(),
    );
  });

  it("notes that the level is managed by the owner when the profile isn't the editor's", () => {
    // The cohort references a profile id absent from the editor's own profiles —
    // e.g. an admin editing a colleague's cohort. The form flags it as read-only
    // so the editor doesn't mistake the empty dropdown for "no level".
    const props = {
      loaderData: {
        mode: "manage" as const,
        canDelete: true,
        tutors,
        profiles: [{ id: "mine", name: "My profile" }],
        cohort: {
          id: "c1",
          name: "SE jaar 2",
          allowedToolSlugs: ["mentorai"],
          config: {},
          contextProfileId: "someone-elses-profile",
          contextEqf: null,
          activeUntil: null,
        },
        models: { catalog: modelCatalog, selected: null },
      },
    } as unknown as ComponentProps<typeof CohortForm>;
    const Stub = createRoutesStub([
      { path: "/cohorts/:id", Component: () => <CohortForm {...props} />, action: () => null },
    ]);
    render(<Stub initialEntries={["/cohorts/c1"]} />);
    expect(screen.getByText(/eigenaar|owner/i)).toBeInTheDocument();
  });

  it("has no a11y violations in manage mode", async () => {
    const { container } = renderManage(true);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no a11y violations", async () => {
    const { container } = renderForm();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("has no a11y violations with the EQF selector expanded", async () => {
    const user = userEvent.setup();
    const { container } = renderForm();
    await user.click(screen.getByRole("radio", { name: /alleen eqf|eqf level only/i }));
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
