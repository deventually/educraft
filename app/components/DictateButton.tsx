import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { cn } from "~/lib/utils";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { useDictationEnabled } from "~/lib/speech/dictation";
import { canRecord, startRecording, type Recording } from "~/lib/speech/recorder";
import { useToast } from "./Toast";

/** A recording stops by itself after this long (the server takes about two minutes). */
const MAX_RECORDING_MS = 115_000;

type Phase = "idle" | "recording" | "transcribing";

/**
 * Dictation for a text field: press to talk, press again to stop. The recording goes to
 * `/api/transcribe` (the school's Whisper server or another configured one, never the
 * browser's own speech service) and the text comes back through `onText`. Renders nothing
 * when this LimeOnIt has no speech server or the browser cannot record.
 */
export function DictateButton({
  lang,
  field,
  onText,
  className,
}: {
  lang: "nl" | "en";
  /** The field's label, so each microphone button has its own name. */
  field?: string;
  onText: (text: string) => void;
  className?: string;
}) {
  const t = useT();
  const enabled = useDictationEnabled();
  const { showToast } = useToast();
  const [phase, setPhase] = useState<Phase>("idle");
  const recording = useRef<Recording | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      recording.current?.cancel();
    },
    [],
  );

  if (!enabled || !canRecord()) return null;
  const m = t.speech;

  async function start() {
    try {
      recording.current = await startRecording();
    } catch {
      showToast({ variant: "error", message: m.micDenied });
      return;
    }
    setPhase("recording");
    timer.current = setTimeout(() => void stop(), MAX_RECORDING_MS);
  }

  async function stop() {
    if (timer.current) clearTimeout(timer.current);
    const rec = recording.current;
    recording.current = null;
    if (!rec) return;
    setPhase("transcribing");
    try {
      const body = new FormData();
      body.set("audio", await rec.stop(), "speech.wav");
      body.set("language", lang);
      const res = await fetch("/api/transcribe", { method: "POST", body });
      const data = (await res.json()) as { text?: unknown };
      if (!res.ok || typeof data.text !== "string") throw new Error(String(res.status));
      if (data.text) onText(data.text);
    } catch {
      showToast({ variant: "error", message: m.dictationFailed });
    } finally {
      setPhase("idle");
    }
  }

  const label =
    phase === "recording"
      ? m.stopDictating
      : phase === "transcribing"
        ? m.transcribing
        : field
          ? fmt(m.dictateInto, { field })
          : m.dictate;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={phase === "transcribing"}
      onClick={() => void (phase === "recording" ? stop() : start())}
      className={cn(
        "inline-grid size-8 shrink-0 place-items-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-wait",
        phase === "recording"
          ? "bg-red-600 text-white hover:bg-red-700"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        className,
      )}
    >
      {phase === "recording" ? (
        <Square className="size-4 animate-pulse" aria-hidden />
      ) : phase === "transcribing" ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Mic className="size-4" aria-hidden />
      )}
    </button>
  );
}
