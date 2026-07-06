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
      exportMd: "Export (Markdown)",
      generating: "Generating…",
    },
  }),
}));

import * as utils from "~/lib/utils";
import { ResultPanel } from "~/components/ResultPanel";

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
    render(<ResultPanel markdown="" filenameBase="Feedback report" streaming />);
    expect(screen.getByText("Generating…")).toBeInTheDocument();
    // Nothing to copy or export yet → both actions are disabled.
    expect(screen.getByRole("button", { name: /copy/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /export/i })).toBeDisabled();
  });

  it("renders streamed markdown as it arrives (a heading becomes a real heading)", () => {
    render(<ResultPanel markdown={MD} filenameBase="Feedback" streaming />);
    expect(screen.getByRole("heading", { name: "Heading one" })).toBeInTheDocument();
    // The placeholder is gone once content exists.
    expect(screen.queryByText("Generating…")).toBeNull();
  });

  it("renders the finished result with the copy action enabled", () => {
    render(<ResultPanel markdown={MD} filenameBase="Feedback" />);
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
    render(<ResultPanel markdown={MD} filenameBase="Feedback" />);
    await user.click(screen.getByRole("button", { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith(MD);
    // The label transitions to the "copied" confirmation.
    expect(await screen.findByRole("button", { name: /copied/i })).toBeInTheDocument();
  });

  it("exports to a filename slugified from filenameBase", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(utils, "downloadText").mockImplementation(() => {});
    render(<ResultPanel markdown={MD} filenameBase="Feedback Report — Q1" />);
    await user.click(screen.getByRole("button", { name: /export/i }));
    expect(spy).toHaveBeenCalledWith("feedback-report-q1.md", MD);
    spy.mockRestore();
  });

  it("has no a11y violations with a rendered result", async () => {
    const { container } = render(<ResultPanel markdown={MD} filenameBase="Feedback" />);
    expect((await axe(container, axeOpts)).violations).toEqual([]);
  });
});
