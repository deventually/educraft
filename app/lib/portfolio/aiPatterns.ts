/**
 * Generic phrasing in a chapter: hollow words, sentences that only stress importance, "niet
 * alleen … maar ook", dashes and summarising openers. They make a text sound like anyone's,
 * and they are frequent in AI text. Advisory and pure, no LLM: the teacher rewrites in their
 * own words, with what really happened. Nothing is changed or blocked.
 *
 * The lists are data, Dutch and English together, so a chapter in either language is checked.
 * When in doubt, no finding: an en dash in "blz. 3–5" or the word "essentie" is ordinary text.
 */

export type AiPatternKind = "hollow" | "emphasis" | "contrast" | "dash" | "wrapUp";

export interface AiPattern {
  kind: AiPatternKind;
  /** The phrase as it stands in the text. */
  text: string;
}

const words = (list: string[]) => new RegExp(`\\b(?:${list.join("|")})\\b`, "giu");

const PATTERNS: { kind: AiPatternKind; re: RegExp }[] = [
  {
    kind: "hollow",
    re: words([
      "cruciale?",
      "cruciaal",
      "essenti(?:ee|ë)le?",
      "waardevol(?:le)?",
      "betekenisvol(?:le)?",
      "naadlo(?:os|ze)",
      "holistische?",
      "transformatieve?",
      "katalysator",
      "sleutelrol",
      "van onschatbare waarde",
      "van groot belang",
      "in het huidige onderwijs(?:landschap)?",
      "steeds veranderende",
      "pivotal",
      "crucial",
      "invaluable",
      "seamless(?:ly)?",
      "holistic",
      "transformative",
      "ever-changing",
      "tapestry",
      "delve",
    ]),
  },
  {
    kind: "emphasis",
    re: words([
      "(?:onderstreept|benadrukt|illustreert|toont aan) het belang van",
      "laat zien hoe belangrijk",
      "(?:underscores|highlights|emphasi[sz]es) the importance of",
    ]),
  },
  { kind: "contrast", re: /\bniet alleen\b[^.!?\n]{1,150}?\bmaar ook\b/giu },
  { kind: "contrast", re: /\bnot (?:only|just)\b[^.!?\n]{1,150}?\bbut also\b/giu },
  // An em dash always; an en dash only as a dash between spaces, not in "3–5".
  { kind: "dash", re: /—|(?<=\s)–(?=\s)/gu },
  {
    kind: "wrapUp",
    re: /(?<=^|[.!?]\s+)(?:Kortom|Al met al|Samenvattend|Concluderend|Alles bij elkaar|In conclusion|In summary|Overall|Ultimately)\b/gmu,
  },
];

/** Every pattern in the text, in reading order. */
export function aiPatternsIn(text: string): AiPattern[] {
  const found: (AiPattern & { at: number })[] = [];
  for (const { kind, re } of PATTERNS)
    for (const m of text.matchAll(re)) found.push({ kind, text: m[0], at: m.index });
  return found.sort((a, b) => a.at - b.at).map(({ kind, text }) => ({ kind, text }));
}
