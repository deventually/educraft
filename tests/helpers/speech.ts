import { vi } from "vitest";

/** A minimal speechSynthesis with one local voice per language, for component tests. */
export function stubSpeech() {
  const spoken: { text: string; lang: string }[] = [];
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
  const voices = [
    { lang: "nl-NL", localService: true, name: "Xander", default: false, voiceURI: "x" },
    { lang: "en-GB", localService: true, name: "Daniel", default: false, voiceURI: "d" },
  ] as SpeechSynthesisVoice[];
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      speak: (u: FakeUtterance) => spoken.push(u),
      cancel: () => {},
      getVoices: () => voices,
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  return {
    spoken,
    restore: () => {
      // @ts-expect-error -- remove the stub again
      delete window.speechSynthesis;
      vi.unstubAllGlobals();
    },
  };
}
