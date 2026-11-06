/**
 * Read aloud (TTS) with the browser's own speechSynthesis. Pure helpers: turning a
 * markdown result into speakable text, and choosing a voice.
 *
 * Privacy: only a voice that runs on the device (`localService`) is used. An online
 * voice (e.g. Chrome's "Google" voices) would send the text, which can contain student
 * work, to a third party. No local voice for the language means no read-aloud button.
 */

export type SpeechLanguage = "nl" | "en";

const LANG_TAG: Record<SpeechLanguage, string> = { nl: "nl-NL", en: "en-GB" };

/** Longest chunk handed to one utterance; some engines stall on very long ones. */
const MAX_CHUNK = 300;

export function speechLang(lang: SpeechLanguage): string {
  return LANG_TAG[lang];
}

const TABLE_DIVIDER = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

function speakableLine(line: string): string {
  if (TABLE_DIVIDER.test(line)) return "";
  let s = line;
  if (s.trim().startsWith("|")) {
    s = s
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean)
      .join(", ");
  }
  return s
    .replace(/^\s*```.*$/, "") // fence markers
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → their text
    .replace(/<[^>]+>/g, "") // html tags
    .replace(/^\s{0,3}#{1,6}\s+/, "") // headings
    .replace(/^\s*>\s?/, "") // quotes
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "") // list markers
    .replace(/(\*\*|__|\*|_|~~|`)/g, "") // emphasis and inline code
    .replace(/\s+/g, " ")
    .trim();
}

/** The words of a markdown text, one line per spoken unit, without markdown syntax. */
export function speakableText(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .map(speakableLine)
    .filter((l) => l.length > 0)
    .join("\n");
}

/** Short pieces to queue as separate utterances: one per line, long lines split at sentence ends. */
export function speakableChunks(markdown: string): string[] {
  const chunks: string[] = [];
  for (const line of speakableText(markdown).split("\n")) {
    if (!line) continue;
    if (line.length <= MAX_CHUNK) {
      chunks.push(line);
      continue;
    }
    let current = "";
    for (const sentence of line.match(/[^.!?]+[.!?]*\s*/g) ?? [line]) {
      const piece = sentence.trim();
      if (current && current.length + 1 + piece.length > MAX_CHUNK) {
        chunks.push(current);
        current = piece;
      } else {
        current = current ? `${current} ${piece}` : piece;
      }
    }
    if (current) chunks.push(current);
  }
  return chunks;
}

/** A device-local voice for the language: exact region first, then any of that language. */
export function pickVoice(
  voices: readonly SpeechSynthesisVoice[],
  lang: SpeechLanguage,
): SpeechSynthesisVoice | null {
  const local = voices.filter((v) => v.localService);
  const norm = (tag: string) => tag.replace("_", "-").toLowerCase();
  const exact = LANG_TAG[lang].toLowerCase();
  return (
    local.find((v) => norm(v.lang) === exact) ??
    local.find((v) => norm(v.lang).split("-")[0] === lang) ??
    null
  );
}
