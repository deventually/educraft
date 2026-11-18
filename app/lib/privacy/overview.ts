/**
 * The overview before sending (anonymiseerpoort step 4): where the teacher does not type (Bewijs
 * in één keer, the review team, the course import, the course evaluation), every replacement is
 * listed per word before anything leaves: "Jan de Vries (12×)". Pure; the same engine as the live
 * preview (`./live`) and the gate, so what the teacher saw is what goes.
 */
import type { KnownPeople } from "./gate";
import {
  type LiveChoices,
  type LiveField,
  type LiveKind,
  type LiveSpan,
  livePreview,
  type PrivacyApproval,
  prepareSend,
} from "./live";
import type { CodeTable } from "./redact";

/** A text that goes to the AI, with the name the teacher knows it by. */
export interface OverviewPart extends LiveField {
  label: string;
  /**
   * The server already holds this text (a course): it is shown, but not sent from the page. The
   * gate replaces in it what the teacher approved here.
   */
  held?: boolean;
}

/** One word with every place it occurs. */
export interface OverviewWord {
  value: string;
  code: string;
  kind: LiveKind;
  kept: boolean;
  count: number;
  /** The parts it occurs in, in order. */
  labels: string[];
  /** A span that stands for the whole word, for the keep toggle. */
  span: LiveSpan;
}

/** Ids are no text: a key named `id`, or ending in `Id` or `Ids`. */
const ID_KEY = /^(id|.*Ids?)$/;

/**
 * Every string in a structured value (a course), one per line, for a part the server holds: what
 * the overview searches. Ids are left out, so a number in an id is not taken for a student number.
 */
export function textOf(value: unknown): string {
  const out: string[] = [];
  const walk = (v: unknown, key = "") => {
    if (typeof v === "string") {
      if (!ID_KEY.test(key) && v.trim()) out.push(v);
    } else if (Array.isArray(v)) {
      if (!ID_KEY.test(key)) for (const x of v) walk(x);
    } else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(value);
  return out.join("\n");
}

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** Every replacement grouped per word, the most frequent first. */
export function overviewWords(
  parts: readonly OverviewPart[],
  known: KnownPeople,
  choices: LiveChoices,
): OverviewWord[] {
  const words = new Map<string, OverviewWord>();
  for (const part of livePreview(parts, known, choices)) {
    for (const s of part.spans) {
      const key = `${s.kind}\u0000${norm(s.value)}`;
      const word = words.get(key);
      if (!word) {
        words.set(key, {
          value: s.value,
          code: s.code,
          kind: s.kind,
          kept: s.kept,
          count: 1,
          labels: [part.label],
          span: { ...s, original: s.value },
        });
        continue;
      }
      word.count++;
      if (!word.labels.includes(part.label)) word.labels.push(part.label);
    }
  }
  return [...words.values()].sort((a, b) => b.count - a.count);
}

/**
 * What leaves once the teacher presses Versturen: the parts the page sends, with the teacher's
 * own names replaced (everything, in student work), and the approval for the gate. A word the
 * teacher added that occurs in text the server holds goes along by name (`replace`), since the
 * server holds it already; it never goes for the parts the page sends.
 */
export function prepareOverview(
  parts: readonly OverviewPart[],
  known: KnownPeople,
  choices: LiveChoices,
): { values: Record<string, string>; codes: CodeTable; approval: PrivacyApproval } {
  const sent = prepareSend({ fields: parts }, known, choices);
  const held = parts.filter((p) => p.held);
  const values = Object.fromEntries(
    parts.filter((p) => !p.held).map((p) => [p.name, sent.values[p.name] ?? p.text]),
  );
  const replace = new Map<string, string>();
  for (const part of livePreview(held, known, choices))
    for (const s of part.spans)
      if (s.kind === "named" && !s.kept) replace.set(norm(s.value), s.value);
  return {
    values,
    codes: sent.codes,
    approval: {
      ...sent.approval,
      ...(replace.size > 0 ? { replace: [...replace.values()].slice(0, 500) } : {}),
    },
  };
}
