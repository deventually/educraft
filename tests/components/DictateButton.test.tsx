import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

vi.mock("~/lib/i18n/useT", () => ({
  useLocale: () => "en",
  useT: () => ({
    speech: {
      dictate: "Dictate",
      dictateInto: "Dictate into {field}",
      dictationFailed: "Dictation did not work. Try again or type.",
      micDenied: "No access to the microphone.",
      stopDictating: "Stop dictating",
      transcribing: "Writing it out…",
    },
  }),
}));

const { startRecording, stop, cancel, showToast } = vi.hoisted(() => {
  const stop = vi.fn();
  const cancel = vi.fn();
  return { stop, cancel, startRecording: vi.fn(), showToast: vi.fn() };
});
vi.mock("~/lib/speech/recorder", () => ({ canRecord: () => true, startRecording }));
vi.mock("~/components/Toast", () => ({
  useToast: () => ({ showToast, updateToast: vi.fn(), dismiss: vi.fn() }),
}));

import { DictateButton } from "~/components/DictateButton";
import { DictationProvider } from "~/lib/speech/dictation";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  stop.mockResolvedValue(new Blob([new Uint8Array(10)], { type: "audio/wav" }));
  startRecording.mockResolvedValue({ stop, cancel });
  fetchMock.mockResolvedValue(Response.json({ text: "Hallo klas" }));
  vi.stubGlobal("fetch", fetchMock);
});

function renderOn(ui: React.ReactNode, enabled = true) {
  return render(<DictationProvider enabled={enabled}>{ui}</DictationProvider>);
}

describe("DictateButton", () => {
  it("renders nothing when dictation is off for this LimeOnIt", () => {
    const { container } = renderOn(<DictateButton lang="nl" onText={() => {}} />, false);
    expect(container).toBeEmptyDOMElement();
  });

  it("records, then sends the audio and language, and hands back the text", async () => {
    const onText = vi.fn();
    const user = userEvent.setup();
    renderOn(<DictateButton lang="nl" field="Learning goal" onText={onText} />);
    await user.click(screen.getByRole("button", { name: "Dictate into Learning goal" }));
    expect(startRecording).toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Stop dictating" }));
    await waitFor(() => expect(onText).toHaveBeenCalledWith("Hallo klas"));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/transcribe");
    const body = init.body as FormData;
    expect(body.get("language")).toBe("nl");
    expect(body.get("audio")).toBeInstanceOf(Blob);
    expect(screen.getByRole("button", { name: "Dictate into Learning goal" })).toBeEnabled();
  });

  it("says so in a toast when the microphone is refused", async () => {
    startRecording.mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));
    const user = userEvent.setup();
    renderOn(<DictateButton lang="en" onText={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Dictate" }));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "No access to the microphone.",
      }),
    );
    expect(screen.getByRole("button", { name: "Dictate" })).toBeInTheDocument();
  });

  it("says so in a toast when the speech server fails, and inserts nothing", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: "failed" }, { status: 502 }));
    const onText = vi.fn();
    const user = userEvent.setup();
    renderOn(<DictateButton lang="en" onText={onText} />);
    await user.click(screen.getByRole("button", { name: "Dictate" }));
    await user.click(await screen.findByRole("button", { name: "Stop dictating" }));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "Dictation did not work. Try again or type.",
      }),
    );
    expect(onText).not.toHaveBeenCalled();
  });

  it("stops the microphone when it leaves the page mid-recording", async () => {
    const user = userEvent.setup();
    const { unmount } = renderOn(<DictateButton lang="en" onText={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Dictate" }));
    await screen.findByRole("button", { name: "Stop dictating" });
    unmount();
    expect(cancel).toHaveBeenCalled();
  });

  it("has no a11y violations, idle or recording", async () => {
    const user = userEvent.setup();
    const { container } = renderOn(<DictateButton lang="en" onText={() => {}} />);
    expect((await axe(container)).violations).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Dictate" }));
    await screen.findByRole("button", { name: "Stop dictating" });
    expect((await axe(container)).violations).toEqual([]);
  });
});
