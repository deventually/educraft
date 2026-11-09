import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

vi.mock("~/lib/i18n/useT", () => ({
  useLocale: () => "en",
  useT: () => ({ speech: { readAloud: "Read aloud", stopReading: "Stop reading" } }),
}));

import { ReadAloudButton } from "~/components/ReadAloudButton";

class FakeUtterance {
  text: string;
  lang = "";
  voice: SpeechSynthesisVoice | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

const voice = (lang: string, localService: boolean, name: string) =>
  ({ lang, localService, name, default: false, voiceURI: name }) as SpeechSynthesisVoice;

let spoken: FakeUtterance[];
let voices: SpeechSynthesisVoice[];
const listeners = new Set<() => void>();
const synth = {
  speak: vi.fn((u: FakeUtterance) => spoken.push(u)),
  cancel: vi.fn(),
  getVoices: () => voices,
  addEventListener: (_: string, fn: () => void) => listeners.add(fn),
  removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
};

beforeEach(() => {
  spoken = [];
  voices = [
    voice("nl-NL", false, "Google Nederlands"),
    voice("nl-NL", true, "Xander"),
    voice("en-GB", true, "Daniel"),
  ];
  vi.clearAllMocks();
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
});

afterEach(() => {
  // @ts-expect-error -- remove the stub again
  delete window.speechSynthesis;
  vi.unstubAllGlobals();
});

describe("ReadAloudButton", () => {
  it("renders nothing when the browser cannot speak", () => {
    // @ts-expect-error -- no speech support
    delete window.speechSynthesis;
    const { container } = render(<ReadAloudButton text="Hallo" lang="nl" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the device has no local voice for the language", () => {
    voices = [voice("nl-NL", false, "Google Nederlands")];
    const { container } = render(<ReadAloudButton text="Hallo" lang="nl" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("appears once the voices load", () => {
    voices = [];
    render(<ReadAloudButton text="Hallo" lang="nl" />);
    expect(screen.queryByRole("button")).toBeNull();
    voices = [voice("nl-NL", true, "Xander")];
    act(() => {
      for (const fn of listeners) fn();
    });
    expect(screen.getByRole("button", { name: "Read aloud" })).toBeInTheDocument();
  });

  it("reads the text without markdown, with the local voice in the right language", async () => {
    const user = userEvent.setup();
    render(<ReadAloudButton text={"# Kop\n\nDit is **goed**."} lang="nl" />);
    await user.click(screen.getByRole("button", { name: "Read aloud" }));
    expect(synth.cancel).toHaveBeenCalled();
    expect(spoken.map((u) => u.text)).toEqual(["Kop", "Dit is goed."]);
    expect(spoken.every((u) => u.lang === "nl-NL" && u.voice?.name === "Xander")).toBe(true);
    expect(screen.getByRole("button", { name: "Stop reading" })).toBeInTheDocument();
  });

  it("stops on a second press", async () => {
    const user = userEvent.setup();
    render(<ReadAloudButton text="Hallo" lang="en" />);
    await user.click(screen.getByRole("button", { name: "Read aloud" }));
    synth.cancel.mockClear();
    await user.click(screen.getByRole("button", { name: "Stop reading" }));
    expect(synth.cancel).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Read aloud" })).toBeInTheDocument();
  });

  it("flips back when the last piece has been spoken", async () => {
    const user = userEvent.setup();
    render(<ReadAloudButton text={"Een.\nTwee."} lang="en" />);
    await user.click(screen.getByRole("button", { name: "Read aloud" }));
    act(() => spoken[0]!.onend?.());
    expect(screen.getByRole("button", { name: "Stop reading" })).toBeInTheDocument();
    act(() => spoken[1]!.onend?.());
    expect(screen.getByRole("button", { name: "Read aloud" })).toBeInTheDocument();
  });

  it("stops speaking when it leaves the page", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ReadAloudButton text="Hallo" lang="en" />);
    await user.click(screen.getByRole("button", { name: "Read aloud" }));
    synth.cancel.mockClear();
    unmount();
    expect(synth.cancel).toHaveBeenCalled();
  });

  it("has no a11y violations", async () => {
    const { container } = render(<ReadAloudButton text="Hallo" lang="en" />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
