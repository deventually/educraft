import { describe, it, expect } from "vitest";
import { pickVoice, speakableChunks, speakableText, speechLang } from "~/lib/speech/readAloud";

describe("speakableText", () => {
  it("drops markdown syntax but keeps the words", () => {
    const md = [
      "# Feedback voor Sam",
      "",
      "Dit is **sterk** en _helder_. Zie [de rubric](https://example.org/r).",
      "",
      "- Punt een",
      "1. Punt twee",
      "> Een citaat",
      "",
      "![plaatje](x.png)",
      "`code` blijft",
    ].join("\n");
    const text = speakableText(md);
    expect(text).toContain("Feedback voor Sam");
    expect(text).toContain("Dit is sterk en helder. Zie de rubric.");
    expect(text).toContain("Punt een");
    expect(text).toContain("Punt twee");
    expect(text).toContain("Een citaat");
    expect(text).toContain("code blijft");
    expect(text).not.toMatch(/[#*_[\]()`>]/);
    expect(text).not.toContain("https://");
    expect(text).not.toContain("plaatje");
  });

  it("reads a table row by row, without pipes or the divider row", () => {
    const md = "| Criterium | Score |\n| --- | --- |\n| Opbouw | 4 |";
    const text = speakableText(md);
    expect(text).not.toContain("|");
    expect(text).not.toContain("---");
    expect(text).toContain("Criterium, Score");
    expect(text).toContain("Opbouw, 4");
  });

  it("drops html tags and fenced code markers", () => {
    expect(speakableText("<br>Hallo\n```ts\nconst a = 1;\n```")).toBe("Hallo\nconst a = 1;");
  });

  it("returns an empty string for whitespace", () => {
    expect(speakableText("  \n\n ")).toBe("");
  });
});

describe("speakableChunks", () => {
  it("gives one chunk per line, so long results do not stall the voice", () => {
    expect(speakableChunks("# Kop\n\nEerste alinea.\nTweede regel.")).toEqual([
      "Kop",
      "Eerste alinea.",
      "Tweede regel.",
    ]);
  });

  it("splits a very long line at sentence ends", () => {
    const line = Array.from({ length: 30 }, (_, i) => `Zin nummer ${i} is hier.`).join(" ");
    const chunks = speakableChunks(line);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(300);
    expect(chunks.join(" ")).toBe(line);
  });
});

describe("speechLang", () => {
  it("maps the output language to a BCP 47 tag", () => {
    expect(speechLang("nl")).toBe("nl-NL");
    expect(speechLang("en")).toBe("en-GB");
  });
});

describe("pickVoice", () => {
  const v = (lang: string, localService: boolean, name = lang) =>
    ({ lang, localService, name, default: false, voiceURI: name }) as SpeechSynthesisVoice;

  it("only picks a voice that runs on the device, never an online one", () => {
    // An online voice sends the text to a server (e.g. Google in Chrome).
    expect(pickVoice([v("nl-NL", false)], "nl")).toBeNull();
    expect(pickVoice([v("nl-NL", false), v("nl-NL", true, "Xander")], "nl")?.name).toBe("Xander");
  });

  it("prefers the exact region, then any voice of that language", () => {
    expect(pickVoice([v("nl-BE", true), v("nl-NL", true)], "nl")?.lang).toBe("nl-NL");
    expect(pickVoice([v("nl_BE", true)], "nl")?.lang).toBe("nl_BE");
    expect(pickVoice([v("en-US", true)], "en")?.lang).toBe("en-US");
  });

  it("returns null when the device has no voice for that language", () => {
    expect(pickVoice([v("de-DE", true)], "nl")).toBeNull();
    expect(pickVoice([], "en")).toBeNull();
  });
});
