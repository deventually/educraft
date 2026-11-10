import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { GeneratorView } from "~/components/GeneratorView";
import { getToolBySlugOrThrow } from "~/lib/registry";
import type { ModelChoice } from "~/lib/assessment-models";

vi.mock("~/lib/streamClient", () => ({ streamPost: vi.fn() }));

// happy-dom loads no stylesheet, so axe can't compute real contrast.
const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const tool = getToolBySlugOrThrow("stage-assessment");
const models: ModelChoice[] = [
  {
    id: "own-essay",
    name: "Mijn essaymodel",
    documentTypes: ["essay"],
    framework: "C1 Stelling",
    scale: "",
    starter: false,
  },
  {
    id: "own-stage",
    name: "Mijn stagemodel",
    documentTypes: ["stageverslag"],
    framework: "SC1 Stage",
    scale: "O/V/G",
    starter: false,
  },
  {
    id: "starter:hbo-i-stage",
    name: "HBO-i stage (Informatica)",
    documentTypes: ["stageverslag"],
    framework: "HBO-i kader",
    scale: "HBO-i schaal",
    starter: true,
  },
];

function renderView(assessmentModels: ModelChoice[] = models) {
  const Stub = createRoutesStub([
    {
      path: "/tools/stage-assessment",
      Component: () => (
        <GeneratorView
          tool={tool}
          profiles={[]}
          defaultProfileId=""
          assessmentModels={assessmentModels}
        />
      ),
    },
  ]);
  return render(<Stub initialEntries={["/tools/stage-assessment"]} />);
}

const framework = () => screen.getByLabelText(/^Beoordelingskader/);
const scale = () => screen.getByLabelText(/^Beoordelingsschaal/);
const picker = () => screen.getByRole("combobox", { name: "Beoordelingsmodel" });
const docType = () => screen.getByRole("combobox", { name: /Type document/ });

describe("GeneratorView — assessment models", () => {
  it("fills in the teacher's own model for the starting document type", async () => {
    renderView();
    expect(await screen.findByRole("combobox", { name: "Beoordelingsmodel" })).toHaveValue(
      "own-stage",
    );
    expect(framework()).toHaveValue("SC1 Stage");
    expect(scale()).toHaveValue("O/V/G");
  });

  it("switches to the own model of another document type, and empties for a type without one", async () => {
    const user = userEvent.setup();
    renderView();
    await user.selectOptions(docType(), "essay");
    expect(picker()).toHaveValue("own-essay");
    expect(framework()).toHaveValue("C1 Stelling");
    expect(scale()).toHaveValue("");

    await user.selectOptions(docType(), "stageplan");
    expect(picker()).toHaveValue("");
    expect(framework()).toHaveValue("");
  });

  it("never fills in a starter by itself, only when the teacher picks it", async () => {
    const user = userEvent.setup();
    renderView(models.filter((m) => m.starter));
    expect(await screen.findByRole("combobox", { name: "Beoordelingsmodel" })).toHaveValue("");
    expect(framework()).toHaveValue("");
    await user.selectOptions(picker(), "starter:hbo-i-stage");
    expect(framework()).toHaveValue("HBO-i kader");
    expect(scale()).toHaveValue("HBO-i schaal");
  });

  it("keeps what the teacher typed when the document type changes", async () => {
    const user = userEvent.setup();
    renderView();
    await user.clear(framework());
    await user.type(framework(), "Eigen kader");
    await user.selectOptions(docType(), "essay");
    expect(framework()).toHaveValue("Eigen kader");
  });

  it("links to the page where the models are managed, and has no axe violations", async () => {
    const { container } = renderView();
    expect(await screen.findByRole("link", { name: "Beheer je modellen" })).toHaveAttribute(
      "href",
      "/assessment-models",
    );
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
