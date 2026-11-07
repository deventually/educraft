import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

vi.mock("~/lib/i18n/useT", () => ({
  useLocale: () => "en",
  useT: () => ({
    tool: {
      result: "Result",
      copy: "Copy",
      copied: "Copied!",
      generating: "Generating…",
      computedByApp: "Computed by LimeOnIt, not by the AI",
    },
    speech: { readAloud: "Read aloud", stopReading: "Stop reading" },
  }),
}));

import { ResultPanel } from "~/components/ResultPanel";
import { stubSpeech } from "../helpers/speech";

// happy-dom loads no stylesheet, so axe can't compute real contrast.
const axeOpts = { rules: { "color-contrast": { enabled: false } } };

const writeText = vi.fn().mockResolvedValue(undefined);
const MD = "# Heading one\n\nSome **bold** body text.";

beforeEach(() => {
  vi.clearAllMocks();
  // happy-dom exposes navigator.clipboard as a getter-only property, so a plain
  // Object.assign throws — define it instead.
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
});

describe("ResultPanel", () => {
  it("shows the generating placeholder while streaming with nothing produced yet", () => {
    render(<ResultPanel markdown="" streaming />);
    expect(screen.getByText("Generating…")).toBeInTheDocument();
    // Nothing to copy yet → the action is disabled.
    expect(screen.getByRole("button", { name: /copy/i })).toBeDisabled();
  });

  it("renders streamed markdown as it arrives (a heading becomes a real heading)", () => {
    render(<ResultPanel markdown={MD} streaming />);
    expect(screen.getByRole("heading", { name: "Heading one" })).toBeInTheDocument();
    // The placeholder is gone once content exists.
    expect(screen.queryByText("Generating…")).toBeNull();
  });

  it("renders the finished result with the copy action enabled", () => {
    render(<ResultPanel markdown={MD} />);
    expect(screen.getByRole("heading", { name: "Heading one" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy/i })).toBeEnabled();
  });

  it("copies the raw markdown and flips the button to the copied label", async () => {
    const user = userEvent.setup();
    // userEvent.setup() installs its own clipboard stub, so (re)define ours after.
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    render(<ResultPanel markdown={MD} />);
    await user.click(screen.getByRole("button", { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith(MD);
    // The label transitions to the "copied" confirmation.
    expect(await screen.findByRole("button", { name: /copied/i })).toBeInTheDocument();
  });

  it("leaves the download to the Exporteer menu (P30.2)", () => {
    render(<ResultPanel markdown={MD} />);
    expect(screen.queryByRole("button", { name: /export/i })).toBeNull();
  });

  it("has no a11y violations with a rendered result", async () => {
    const { container } = render(<ResultPanel markdown={MD} />);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("reads a finished result aloud in the result's language", async () => {
    const speech = stubSpeech();
    const user = userEvent.setup();
    render(<ResultPanel markdown={MD} lang="nl" />);
    await user.click(screen.getByRole("button", { name: "Read aloud" }));
    expect(speech.spoken.map((u) => u.text)).toEqual(["Heading one", "Some bold body text."]);
    expect(speech.spoken[0].lang).toBe("nl-NL");
    speech.restore();
  });

  it("offers no read-aloud while the result is still streaming", () => {
    const speech = stubSpeech();
    render(<ResultPanel markdown={MD} streaming />);
    expect(screen.queryByRole("button", { name: "Read aloud" })).toBeNull();
    speech.restore();
  });

  it("shows a note computed in code under a finished result, labelled as not from the AI (P31.3)", async () => {
    const { container } = render(
      <ResultPanel markdown={MD} computed="Engagement score: 9 of 18 points (50%)." />,
    );
    const note = screen.getByRole("note", { name: "Computed by LimeOnIt, not by the AI" });
    expect(note).toHaveTextContent("Engagement score: 9 of 18 points (50%).");
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });

  it("shows no computed note while streaming", () => {
    render(<ResultPanel markdown={MD} streaming computed="Score: 1." />);
    expect(screen.queryByRole("note")).toBeNull();
  });
});
