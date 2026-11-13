/**
 * The Bloom level of one learning outcome from TypeSafe's Jev (a decision model, not an LLM):
 * one yes/no per level ("does `outcome` have a verb of this level?"), and code takes the highest
 * level at or above the threshold (TypeSafe: Jev judges, code decides). Pure: the request and
 * the reading of the answer; the call is `app/server/courseImport.server.ts`.
 *
 * Measured three times against the LLM and a verb list on Bastiaan's labels
 * (`evals/bloom-jev/README.md`); the eval builds its requests with this module, so it measures
 * what the app sends.
 */
import { z } from "zod";
import type { Locale } from "~/lib/i18n";
import { BLOOM_LEVELS, type BloomLevel } from "./bloom";

/** All question wording in one place (TypeSafe's skill). */
const TEXT = {
  nl: {
    about: "`outcome` is één leeruitkomst, letterlijk overgenomen uit een cursusdocument.",
    ask: (name: string) =>
      `Staat er in \`outcome\` een werkwoord dat duidelijk het Bloom-niveau ${name} aangeeft?`,
    yes: (what: string) => `Ja: een werkwoord vraagt om ${what}.`,
    no: "Nee: geen werkwoord van dit niveau, of alleen een vaag werkwoord (zoals kent, begrijpt, heeft inzicht in, is zich bewust van).",
    levels: {
      remember: ["Onthouden", "feiten of begrippen ophalen, zoals benoemen, opsommen, herkennen"],
      understand: [
        "Begrijpen",
        "betekenis geven, zoals uitleggen, verklaren, beschrijven, samenvatten",
      ],
      apply: [
        "Toepassen",
        "een methode of procedure uitvoeren, zoals toepassen, berekenen, uitvoeren",
      ],
      analyze: [
        "Analyseren",
        "in delen uiteenrafelen en verbanden zien, zoals analyseren, vergelijken, onderscheiden",
      ],
      evaluate: [
        "Evalueren",
        "oordelen op basis van criteria, zoals beoordelen, evalueren, beargumenteren, kritisch reflecteren",
      ],
      create: [
        "Creëren",
        "iets nieuws samenstellen, zoals ontwerpen, ontwikkelen, bouwen, opstellen",
      ],
    },
  },
  en: {
    about: "`outcome` is one learning outcome, copied verbatim from a course document.",
    ask: (name: string) =>
      `Does \`outcome\` contain a verb that clearly signals the Bloom level ${name}?`,
    yes: (what: string) => `Yes: a verb asks for ${what}.`,
    no: "No: no verb of this level, or only a vague verb (such as knows, understands, is familiar with, is aware of).",
    levels: {
      remember: ["Remember", "retrieving facts or concepts, such as naming, listing, recognising"],
      understand: [
        "Understand",
        "making meaning, such as explaining, describing, summarising, interpreting",
      ],
      apply: [
        "Apply",
        "carrying out a method or procedure, such as applying, calculating, executing",
      ],
      analyze: [
        "Analyse",
        "breaking into parts and seeing relations, such as analysing, comparing, differentiating",
      ],
      evaluate: [
        "Evaluate",
        "judging against criteria, such as assessing, evaluating, justifying, critically reflecting",
      ],
      create: [
        "Create",
        "putting together something new, such as designing, developing, building, formulating",
      ],
    },
  },
} satisfies Record<
  Locale,
  { levels: Record<BloomLevel, [string, string]> } & Record<string, unknown>
>;

export interface BloomJevRequest {
  model: string;
  state: { outcome: string; language: Locale; about_outcome: string };
  questions: Record<
    string,
    { type: "noul"; instructions: string; criteria: { true: string; false: string } }
  >;
}

export function buildBloomJevRequest(
  outcome: string,
  locale: Locale,
  model: string,
): BloomJevRequest {
  const t = TEXT[locale];
  return {
    model,
    state: { outcome, language: locale, about_outcome: t.about },
    questions: Object.fromEntries(
      BLOOM_LEVELS.map((l) => {
        const [name, what] = t.levels[l];
        return [
          `has_${l}`,
          {
            type: "noul" as const,
            instructions: t.ask(name),
            criteria: { true: t.yes(what), false: t.no },
          },
        ];
      }),
    ),
  };
}

/**
 * From this yes-probability a level counts. TypeSafe's starting point, and what the calibration
 * on the tuning sets chose; the fresh holdouts (rounds 2 and 3) were measured with it.
 */
export const BLOOM_JEV_THRESHOLD = 0.7;

export type LevelP = Partial<Record<BloomLevel, number>>;

const Response = z.object({
  answers: z.record(z.string(), z.object({ type: z.string(), noul: z.number().optional() })),
  usage: z.object({ cost: z.number().optional() }).partial().optional(),
});

/** Every level's yes-probability, kept so the threshold can be set afterwards. */
export function parseBloomJevAnswer(body: unknown): {
  p: LevelP;
  usable: boolean;
  costUsd?: number;
} {
  const parsed = Response.safeParse(body);
  if (!parsed.success) return { p: {}, usable: false };
  const p: LevelP = {};
  for (const l of BLOOM_LEVELS) {
    const a = parsed.data.answers[`has_${l}`];
    if (a?.type === "noul" && a.noul !== undefined) p[l] = a.noul;
  }
  const cost = parsed.data.usage?.cost;
  return { p, usable: true, ...(cost !== undefined ? { costUsd: cost } : {}) };
}

/** The truth table: the highest level whose yes-probability reaches the threshold; else none. */
export function jevLevel(p: LevelP, threshold = BLOOM_JEV_THRESHOLD): BloomLevel | null {
  let best: BloomLevel | null = null;
  for (const l of BLOOM_LEVELS) if ((p[l] ?? 0) >= threshold) best = l;
  return best;
}
