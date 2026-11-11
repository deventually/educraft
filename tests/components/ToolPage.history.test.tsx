import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createRoutesStub, useNavigate } from "react-router";
import ToolPage from "~/routes/tool";
import { getToolBySlug, type Tool } from "~/lib/registry";
import { getMessages } from "~/lib/i18n";

// The transport is mocked: each run streams a numbered result and reports where it was saved.
vi.mock("~/lib/streamClient", () => ({ streamPost: vi.fn() }));

const m = getMessages("nl"); // no root loader → Dutch
const axeOpts = { rules: { "color-contrast": { enabled: false } } };

async function streamSpy() {
  const { streamPost } = await import("~/lib/streamClient");
  return streamPost as unknown as ReturnType<typeof vi.fn>;
}

function Nav() {
  const navigate = useNavigate();
  return (
    <nav>
      <button type="button" onClick={() => navigate(-1)}>
        back
      </button>
      <button type="button" onClick={() => navigate(1)}>
        forward
      </button>
      <button type="button" onClick={() => navigate("/course")}>
        to course
      </button>
      <button type="button" onClick={() => navigate("/tool")}>
        open tool
      </button>
    </nav>
  );
}

function renderApp(tool: Tool, start = "/course") {
  const loaderData = {
    tool,
    profiles: [],
    defaultProfileId: "",
    verbatim: tool.stages.map((s) => ({ name: s.name, text: "" })),
    localModels: [],
    catalogModels: [],
    helpOverlay: null,
    courses: [],
    initialCourseId: "",
    initialItemId: "",
    nextTools: [],
    linkTargets: [],
    dossiers: [],
    forCriterion: null,
    assessmentModels: [],
    aiLimit: null,
    studentPrompt: null,
  };
  const props = { loaderData } as unknown as ComponentProps<typeof ToolPage>;
  const Stub = createRoutesStub([
    {
      path: "/tool",
      Component: () => (
        <>
          <Nav />
          <ToolPage {...props} />
        </>
      ),
    },
    {
      path: "/course",
      Component: () => (
        <>
          <Nav />
          <h1>Course page</h1>
        </>
      ),
    },
  ]);
  return render(<Stub initialEntries={[start]} />);
}

let runs = 0;
beforeEach(async () => {
  window.sessionStorage.clear();
  runs = 0;
  const spy = await streamSpy();
  spy.mockReset();
  spy.mockImplementation(async (_url, body, handlers) => {
    runs += 1;
    handlers.onToken(`RESULT-${runs}-${body.stageId ?? ""}`);
    handlers.onDone?.({ generationId: `gen-${runs}` });
  });
});

const user = () => userEvent.setup();

/** Fill every text field, so the required-field check passes. */
async function fill(u: ReturnType<typeof userEvent.setup>, text: string) {
  for (const box of screen.getAllByRole("textbox")) {
    await u.clear(box);
    await u.type(box, text);
  }
}

describe("Tool page — Back and Forward keep the work (one-shot)", () => {
  const tool = getToolBySlug("differentiation")!;

  it("shows the result and the input again after going to the course and coming back", async () => {
    const u = user();
    const { container } = renderApp(tool);
    await u.click(screen.getByRole("button", { name: "open tool" }));
    await fill(u, "photosynthesis");
    await u.click(screen.getByRole("button", { name: m.tool.generate }));
    expect(await screen.findByText(/RESULT-1/)).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: "back" }));
    expect(await screen.findByRole("heading", { name: "Course page" })).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "forward" }));

    expect(await screen.findByText(/RESULT-1/)).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")[0]).toHaveValue("photosynthesis");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("goes back to an earlier visit of the same tool with that visit's own result", async () => {
    const u = user();
    renderApp(tool);
    await u.click(screen.getByRole("button", { name: "open tool" }));
    await fill(u, "first");
    await u.click(screen.getByRole("button", { name: m.tool.generate }));
    expect(await screen.findByText(/RESULT-1/)).toBeInTheDocument();

    // Opened again (a new visit): an empty form, no result.
    await u.click(screen.getByRole("button", { name: "open tool" }));
    expect(screen.queryByText(/RESULT-1/)).toBeNull();
    expect(screen.getAllByRole("textbox")[0]).toHaveValue("");

    await u.click(screen.getByRole("button", { name: "back" }));
    expect(await screen.findByText(/RESULT-1/)).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")[0]).toHaveValue("first");
  });

  it("does not keep a result from before a new run that was still streaming", async () => {
    const spy = await streamSpy();
    const u = user();
    renderApp(tool);
    await u.click(screen.getByRole("button", { name: "open tool" }));
    await fill(u, "x");
    await u.click(screen.getByRole("button", { name: m.tool.generate }));
    expect(await screen.findByText(/RESULT-1/)).toBeInTheDocument();

    // The second run never finishes: the old result is gone from the screen and from memory.
    spy.mockImplementation(async () => {});
    await u.click(screen.getByRole("button", { name: m.tool.generate }));
    expect(screen.queryByText(/RESULT-1/)).toBeNull();
    await u.click(screen.getByRole("button", { name: m.tool.stop }));

    await u.click(screen.getByRole("button", { name: "back" }));
    await u.click(screen.getByRole("button", { name: "forward" }));
    expect(screen.getAllByRole("textbox")[0]).toHaveValue("x");
    expect(screen.queryByText(/RESULT-1/)).toBeNull();
  });
});

describe("Tool page — Back and Forward keep the work (multi-stage)", () => {
  const tool = getToolBySlug("cognitive-architect")!;

  it("shows the finished steps again after going back and forward", async () => {
    const u = user();
    renderApp(tool);
    await u.click(screen.getByRole("button", { name: "open tool" }));
    await fill(u, "x");
    await u.click(screen.getAllByRole("button", { name: m.tool.runStage })[0]!);
    expect(await screen.findByText(/RESULT-1-analyst/)).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: "back" }));
    await screen.findByRole("heading", { name: "Course page" });
    await u.click(screen.getByRole("button", { name: "forward" }));

    expect(await screen.findByText(/RESULT-1-analyst/)).toBeInTheDocument();
    // The next step is open again, because the first one has its result.
    expect(screen.getAllByRole("button", { name: m.tool.runStage })[0]).toBeEnabled();
  });
});

describe("Tool page — Back and Forward keep the work (chat)", () => {
  const tool = getToolBySlug("bloom-by-design")!;

  it("shows the conversation again and goes on in the same saved chat", async () => {
    const spy = await streamSpy();
    const u = user();
    renderApp(tool);
    await u.click(screen.getByRole("button", { name: "open tool" }));
    await fill(u, "biology");
    await u.click(screen.getByRole("button", { name: m.chat.continue }));
    await u.type(screen.getByPlaceholderText(m.chat.inputPlaceholder), "Hello{Enter}");
    expect(await screen.findByText(/RESULT-1/)).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: "back" }));
    await screen.findByRole("heading", { name: "Course page" });
    await u.click(screen.getByRole("button", { name: "forward" }));

    expect(await screen.findByText(/RESULT-1/)).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
    await u.type(screen.getByPlaceholderText(m.chat.inputPlaceholder), "More{Enter}");
    expect(await screen.findByText(/RESULT-2/)).toBeInTheDocument();
    const [first, second] = spy.mock.calls.map((c) => c[1]);
    expect(second.sessionId).toBe(first.sessionId);
    expect(second.messages.map((x: { content: string }) => x.content)).toEqual([
      "Hello",
      expect.stringMatching(/RESULT-1/),
      "More",
    ]);
  });
});
