import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub } from "react-router";
import { getToolBySlug } from "~/lib/registry";
import { getMessages } from "~/lib/i18n";
import { StageStepper } from "~/components/StageStepper";

// The client transport is mocked so no network/stream happens; the spy captures
// the payload each stage POSTs (crucially the threaded `priorOutputs`).
vi.mock("~/lib/streamClient", () => ({ streamPost: vi.fn() }));

const m = getMessages("nl"); // no root loader → components resolve to Dutch
const axeOpts = { rules: { "color-contrast": { enabled: false } } };
// Cognitive Architect: the only multi-stage tool — analyst → generator → …
const tool = getToolBySlug("cognitive-architect")!;

async function streamSpy() {
  const { streamPost } = await import("~/lib/streamClient");
  return streamPost as unknown as ReturnType<typeof vi.fn>;
}

function renderStepper() {
  // A data-router stub supplies the context i18n reads; with no root loader the
  // components resolve to Dutch (DEFAULT_LOCALE).
  const Stub = createRoutesStub([
    { path: "/", Component: () => <StageStepper tool={tool} profiles={[]} defaultProfileId="" /> },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

/** Fill every text/textarea so the entry stage's required-field gate passes. */
async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  for (const box of screen.getAllByRole("textbox")) await user.type(box, "x");
}

beforeEach(async () => {
  (await streamSpy()).mockReset();
});

describe("StageStepper (multi-stage)", () => {
  it("renders one card per stage of the tool", () => {
    renderStepper();
    expect(screen.getByRole("heading", { name: /Instructional Analyst/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Student Prompt Generator/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Quality Validator/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Transcript Analyst/i })).toBeInTheDocument();
  });

  it("keeps a downstream stage locked until its dependency has produced output", () => {
    renderStepper();
    const runButtons = screen.getAllByRole("button", { name: m.tool.runStage });
    // Entry stage (analyst) is runnable; every consuming stage is disabled.
    expect(runButtons[0]).toBeEnabled();
    expect(runButtons[1]).toBeDisabled();
    expect(runButtons[2]).toBeDisabled();
    expect(runButtons[3]).toBeDisabled();
  });

  it("blocks generation with a localized error when required fields are empty", async () => {
    const spy = await streamSpy();
    const user = userEvent.setup();
    renderStepper();
    // Run the entry stage without filling anything.
    await user.click(screen.getAllByRole("button", { name: m.tool.runStage })[0]);
    expect(screen.getByText(m.tool.required, { exact: false })).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it("threads a completed stage's output into the next stage's request body", async () => {
    const spy = await streamSpy();
    spy.mockImplementation(async (_url, _body, handlers) => {
      handlers.onToken(_body.stageId === "analyst" ? "COORDS-DOC" : "child");
      handlers.onDone?.();
    });
    const user = userEvent.setup();
    renderStepper();
    await fillRequired(user);

    // Stage 1 posts with no prior outputs.
    await user.click(screen.getAllByRole("button", { name: m.tool.runStage })[0]);
    expect(spy.mock.calls[0][1].stageId).toBe("analyst");
    expect(spy.mock.calls[0][1].priorOutputs).toEqual({});

    // Stage 1 now shows a re-run control; the generator has unlocked.
    const nowRunnable = screen.getAllByRole("button", { name: m.tool.runStage });
    expect(nowRunnable[0]).toBeEnabled(); // generator
    await user.click(nowRunnable[0]);

    const genCall = spy.mock.calls.find((c) => c[1].stageId === "generator");
    expect(genCall).toBeTruthy();
    expect(genCall![1].priorOutputs.analyst).toBe("COORDS-DOC");
  });

  it("leaves a re-runnable stage after aborting a stream mid-flight", async () => {
    const spy = await streamSpy();
    // Emit a partial token but never complete → the stage stays 'streaming'.
    spy.mockImplementation(async (_url, _body, handlers) => {
      handlers.onToken("partial output");
    });
    const user = userEvent.setup();
    renderStepper();
    await fillRequired(user);
    await user.click(screen.getAllByRole("button", { name: m.tool.runStage })[0]);

    // Streaming → a Stop control is offered for that stage.
    const stop = screen.getByRole("button", { name: m.tool.stop });
    await user.click(stop);

    // After abort the partial output remains and the stage is re-runnable.
    const regenerate = screen.getByRole("button", { name: m.tool.regenerate });
    expect(regenerate).toBeEnabled();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderStepper();
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
