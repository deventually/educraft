import { useEffect, useRef, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { Button } from "./ui";
import {
  pickVoice,
  speakableChunks,
  speechLang,
  type SpeechLanguage,
} from "~/lib/speech/readAloud";
import { useT } from "~/lib/i18n/useT";

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null;
}

/**
 * "Read aloud" for a result or chat answer, with the browser's speechSynthesis and a
 * voice that runs on the device (see `~/lib/speech/readAloud`). Renders nothing when the
 * device cannot read this language locally, so the button never promises what it can't do.
 */
export function ReadAloudButton({ text, lang }: { text: string; lang: SpeechLanguage }) {
  const t = useT();
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speaking, setSpeaking] = useState(false);
  // Each start gets its own run, so a cancelled run's late callbacks change nothing.
  const run = useRef(0);

  useEffect(() => {
    const s = synth();
    if (!s) return;
    const update = () => setVoice(pickVoice(s.getVoices(), lang));
    update();
    s.addEventListener("voiceschanged", update);
    return () => s.removeEventListener("voiceschanged", update);
  }, [lang]);

  // Leaving the page stops this button's reading, not someone else's.
  const speakingRef = useRef(false);
  speakingRef.current = speaking;
  useEffect(
    () => () => {
      if (speakingRef.current) synth()?.cancel();
    },
    [],
  );

  const chunks = speakableChunks(text);
  if (!voice || chunks.length === 0) return null;

  function start() {
    const s = synth();
    if (!s || !voice) return;
    s.cancel();
    const id = ++run.current;
    const done = () => {
      if (run.current === id) setSpeaking(false);
    };
    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = speechLang(lang);
      u.voice = voice;
      u.onerror = done;
      if (i === chunks.length - 1) u.onend = done;
      s.speak(u);
    });
    setSpeaking(true);
  }

  function stop() {
    run.current++;
    synth()?.cancel();
    setSpeaking(false);
  }

  return (
    <Button type="button" size="sm" variant="ghost" onClick={speaking ? stop : start}>
      {speaking ? (
        <Square className="size-4" aria-hidden />
      ) : (
        <Volume2 className="size-4" aria-hidden />
      )}
      {speaking ? t.speech.stopReading : t.speech.readAloud}
    </Button>
  );
}
