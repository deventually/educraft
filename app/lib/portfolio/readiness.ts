/**
 * "Klaar om in te leveren?" (brief P29, 29.1): one advisory list that says
 * whether a dossier is ready to hand in. Pure, no LLM. Advice, with one gate:
 * an open spot (`open-spot`, `evidence-pending`, an empty chapter) keeps the
 * final export back; a draft version always works (BESLUIT-2026-11-07-4). Only what the confirmed framework asks for is checked;
 * there are no national rules in here, and BDB and BKE differ only by data.
 *
 * When in doubt, no finding: a missed point is better than a false alarm.
 */
import { evidenceOutcome, openSpots } from "./openSpots";
import { outcomeProgress, requirementFindings, wordCount } from "./progress";
import type { DossierData } from "./types";

/** Every check, in the order the list shows them. */
export const READINESS_CODES = [
  "framework-unconfirmed",
  "criterion-unverified",
  "criterion-without-evidence",
  "required-evidence-missing",
  "chapter-empty",
  "open-spot",
  "evidence-pending",
  "criterion-not-shown",
  "over-word-limit",
  "citation-not-in-references",
  "reference-not-cited",
  "ai-disclosure-missing",
  "min-constructed-items",
  "min-analysed-items",
  "no-student-names",
] as const;
export type ReadinessCode = (typeof READINESS_CODES)[number];

/** Checks the app cannot (always) verify: the teacher ticks them off. */
export const TICKABLE_CODES = [
  "ai-disclosure-missing",
  "min-constructed-items",
  "min-analysed-items",
  "no-student-names",
] as const satisfies readonly ReadinessCode[];
export type TickableCode = (typeof TICKABLE_CODES)[number];

export type ReadinessLevel = "ok" | "warn" | "block";

/** Where the teacher fixes a point. */
export type ReadinessFix =
  | { to: "framework" }
  | { to: "evidence"; outcomeId: string }
  | { to: "chapter"; outcomeId: string }
  | { to: "criterion"; outcomeId: string; criterionId: string }
  | { to: "references" }
  | { to: "export" };

export interface ReadinessItem {
  code: ReadinessCode;
  level: ReadinessLevel;
  outcomeId?: string;
  criterionId?: string;
  /** The text the point is about: a required-evidence line, a citation, a reference. */
  detail?: string;
  /** A counted value and its limit (words, questions). */
  count?: number;
  limit?: number;
  /** A self-check: shown as a checkbox. */
  tick?: true;
  /** When the teacher ticked it off. */
  tickedAt?: number;
  fix?: ReadinessFix;
}

export interface Citation {
  /** As written, e.g. "Biggs & Tang, 2011". */
  text: string;
  /** The first author's surname without Dutch prefixes, e.g. "Akker". */
  surname: string;
  year: string;
}

const PREFIX =
  "(?:(?:[Vv]an|[Dd]e|[Dd]er|[Dd]en|[Vv]on|[Tt]en|[Tt]er|[Tt]e|[Dd]u|[Ll]e|[Ll]a|'t)\\s+)*";
const NAME = "\\p{Lu}[\\p{L}'’-]+";
const AUTHOR = `${PREFIX}${NAME}`;
const AUTHORS = `${AUTHOR}(?:\\s*(?:&|en|and)\\s+${AUTHOR})?(?:\\s+(?:e\\.a\\.|et al\\.))?`;
const YEAR = "((?:19|20)\\d{2})[a-z]?";

/** One part of a bracket: "Biggs & Tang, 2011, p. 4". */
const BRACKET_PART = new RegExp(`^(${AUTHORS}),?\\s+${YEAR}(?:\\s*,.*)?$`, "u");
/** "Biggs en Tang (2011)" in running text. */
const NARRATIVE = new RegExp(`(${AUTHORS})\\s+\\(${YEAR}(?:,[^)]*)?\\)`, "gu");
const BRACKET = /\(([^()]*)\)/g;
const SURNAME = new RegExp(NAME, "u");

/** Capitalized words that start a sentence, not a name. */
const NOT_A_NAME = new Set(
  "in op na om tot voor sinds tijdens dit dat de het een en maar ook toen daarna the this that since after before during and but then also".split(
    " ",
  ),
);

function firstSurname(authors: string): string | null {
  const first = authors.split(/\s*(?:&|\ben\b|\band\b|\be\.a\.|\bet al\.)/)[0].trim();
  const words = first.split(/\s+/).filter((w) => SURNAME.test(w));
  const surname = words[words.length - 1];
  if (!surname || NOT_A_NAME.has(surname.toLowerCase())) return null;
  return surname;
}

/** (Author, year) and Author (year) citations in a text, each once. */
export function citationsIn(text: string): Citation[] {
  const found: Citation[] = [];
  const seen = new Set<string>();
  const add = (authors: string, year: string, written: string) => {
    const surname = firstSurname(authors);
    if (!surname) return;
    const key = `${surname.toLowerCase()} ${year}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ text: written, surname, year });
  };
  for (const m of text.matchAll(BRACKET)) {
    for (const part of m[1].split(";")) {
      const p = BRACKET_PART.exec(part.trim());
      if (p) add(p[1], p[2], `${p[1]}, ${p[2]}`);
    }
  }
  for (const m of text.matchAll(NARRATIVE)) add(m[1], m[2], `${m[1]}, ${m[2]}`);
  return found;
}

/** Surname + year of an APA line, or null when the line cannot be read. */
function referenceKey(apa: string): { surname: string; year: string } | null {
  const year = /\(((?:19|20)\d{2})[a-z]?[),]/.exec(apa);
  if (!year) return null;
  const authors = apa
    .slice(0, year.index)
    .split(",")[0]
    .replace(/\.\s*$/, "");
  const surname = firstSurname(authors);
  return surname ? { surname, year: year[1] } : null;
}

const inReferences = (c: Citation, refs: string[]) =>
  refs.some((r) => r.toLowerCase().includes(c.surname.toLowerCase()) && r.includes(c.year));

/** Questions in the linked test snapshots (P26.4 `itemCount`). */
function constructedItems(d: DossierData): number {
  return d.evidence.reduce(
    (n, e) =>
      e.sourceCourse && typeof e.sourceCourse.part !== "string"
        ? n + (e.sourceCourse.itemCount ?? 0)
        : n,
    0,
  );
}

/** The full list: per check its findings, or one `ok` item when the check applies and is clean. */
export function readinessCheck(d: DossierData): ReadinessItem[] {
  const items: ReadinessItem[] = [];
  const outcomes = d.framework.outcomes;
  const criteria = outcomes.flatMap((o) => o.criteria.map((c) => ({ o, c })));
  const req = d.framework.requirements;
  const ticked = d.readiness?.ticked ?? {};

  const check = (code: ReadinessCode, findings: Omit<ReadinessItem, "code">[]) => {
    if (findings.length) for (const f of findings) items.push({ code, ...f });
    else items.push({ code, level: "ok" });
  };
  /** A self-check: ok when counted (`met`) or ticked; otherwise at `level`. */
  const selfCheck = (
    code: TickableCode,
    level: ReadinessLevel,
    extra: Omit<ReadinessItem, "code" | "level" | "tick"> = {},
    met = false,
  ) => {
    const at = ticked[code];
    const item: ReadinessItem = { code, level: met || at !== undefined ? "ok" : level, tick: true };
    if (at !== undefined && !met) item.tickedAt = at;
    items.push({ ...item, ...extra });
  };

  check(
    "framework-unconfirmed",
    d.framework.confirmedAt === undefined ? [{ level: "block", fix: { to: "framework" } }] : [],
  );

  if (criteria.length > 0) {
    check(
      "criterion-unverified",
      criteria
        .filter(({ c }) => c.unverified)
        .map(({ o, c }) => ({
          level: "warn",
          outcomeId: o.id,
          criterionId: c.id,
          fix: { to: "framework" },
        })),
    );
    check(
      "criterion-without-evidence",
      requirementFindings(d).flatMap((f) =>
        f.code === "criterion-without-evidence"
          ? [
              {
                level: "block" as const,
                outcomeId: f.outcomeId,
                criterionId: f.criterionId,
                fix: { to: "evidence" as const, outcomeId: f.outcomeId },
              },
            ]
          : [],
      ),
    );
  }

  if (outcomes.some((o) => o.requiredEvidence.length > 0)) {
    check(
      "required-evidence-missing",
      outcomeProgress(d).flatMap((p) =>
        p.missingEvidence.map((line) => ({
          level: "block" as const,
          outcomeId: p.outcomeId,
          detail: line,
          fix: { to: "evidence" as const, outcomeId: p.outcomeId },
        })),
      ),
    );
  }

  const withCriteria = outcomes.filter((o) => o.criteria.length > 0);
  // Every outcome is a chapter in the export, so every one needs text (BESLUIT-2026-11-07-4).
  if (outcomes.length > 0) {
    const words = new Map(d.chapters.map((ch) => [ch.outcomeId, wordCount(ch.text)]));
    check(
      "chapter-empty",
      outcomes
        .filter((o) => !words.get(o.id))
        .map((o) => ({
          level: "block",
          outcomeId: o.id,
          fix: { to: "chapter", outcomeId: o.id },
        })),
    );
  }

  // Open spots (BESLUIT-2026-11-07-4): what the final export refuses to carry.
  const spots = openSpots(d);
  const spotItems = (kind: "marker" | "empty", where?: "evidence") =>
    spots
      .filter((s) => s.kind === kind && (!where || s.where === where))
      .map((s): Omit<ReadinessItem, "code"> => {
        const outcomeId = s.where === "chapter" ? s.outcomeId : evidenceOutcome(d, s.evidenceId);
        if (!outcomeId) return { level: "block", detail: s.text };
        const to = s.where === "chapter" ? ("chapter" as const) : ("evidence" as const);
        return { level: "block", outcomeId, detail: s.text, fix: { to, outcomeId } };
      });
  if (d.chapters.length > 0 || d.evidence.length > 0) check("open-spot", spotItems("marker"));
  if (d.evidence.length > 0) check("evidence-pending", spotItems("empty", "evidence"));

  if (withCriteria.length > 0) {
    check(
      "criterion-not-shown",
      criteria
        .filter(({ c }) => d.status[c.id] !== "shown")
        .map(({ o, c }) => ({
          level: "warn",
          outcomeId: o.id,
          criterionId: c.id,
          fix: { to: "criterion", outcomeId: o.id, criterionId: c.id },
        })),
    );
  }

  if (req.maxWords) {
    const over = requirementFindings(d).find((f) => f.code === "over-word-limit");
    const longest = [...d.chapters].sort((a, b) => wordCount(b.text) - wordCount(a.text))[0];
    check(
      "over-word-limit",
      over && over.code === "over-word-limit"
        ? [
            {
              level: "block",
              count: over.words,
              limit: over.limit,
              ...(longest ? { fix: { to: "chapter", outcomeId: longest.outcomeId } } : {}),
            },
          ]
        : [],
    );
  }

  const refs = d.references.map((r) => r.apa);
  const cited = d.chapters.flatMap((ch) =>
    citationsIn(ch.text).map((c) => ({ ...c, outcomeId: ch.outcomeId })),
  );
  if (cited.length > 0) {
    const seen = new Set<string>();
    check(
      "citation-not-in-references",
      cited
        .filter((c) => !inReferences(c, refs))
        .filter((c) => {
          const key = `${c.surname.toLowerCase()} ${c.year}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((c) => ({
          level: "warn",
          outcomeId: c.outcomeId,
          detail: c.text,
          fix: { to: "references" },
        })),
    );
  }

  if (refs.length > 0) {
    const allText = d.chapters
      .map((ch) => ch.text)
      .join("\n")
      .toLowerCase();
    check(
      "reference-not-cited",
      refs
        .filter((apa) => {
          const key = referenceKey(apa);
          if (!key) return false;
          // Lenient: any mention of the surname counts, whatever the citation style.
          const s = key.surname.toLowerCase();
          return (
            !cited.some((c) => c.surname.toLowerCase() === s && c.year === key.year) &&
            !allText.includes(s)
          );
        })
        .map((apa) => ({ level: "warn", detail: apa, fix: { to: "references" } })),
    );
  }

  if (req.aiDisclosureRequired && d.aiLog.length > 0)
    selfCheck("ai-disclosure-missing", "block", { fix: { to: "export" } });

  if (req.minConstructedItems !== undefined) {
    const count = constructedItems(d);
    const first = outcomes[0];
    selfCheck(
      "min-constructed-items",
      "warn",
      {
        count,
        limit: req.minConstructedItems,
        ...(first ? { fix: { to: "evidence", outcomeId: first.id } } : {}),
      },
      count >= req.minConstructedItems,
    );
  }
  if (req.minAnalysedItems !== undefined)
    selfCheck("min-analysed-items", "warn", { limit: req.minAnalysedItems });

  selfCheck("no-student-names", "warn");

  return items;
}

/** "Nog N punten open, waarvan M blokkerend". */
export function readinessSummary(items: ReadinessItem[]): { open: number; blocking: number } {
  return {
    open: items.filter((i) => i.level !== "ok").length,
    blocking: items.filter((i) => i.level === "block").length,
  };
}
