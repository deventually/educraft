import { useMemo, useRef, useState } from "react";
import {
  emptyNamed,
  isKeepWord,
  type LiveChoices,
  type LiveField,
  type LiveSpan,
  livePreview,
  type NamedPeople,
  type PrivacyPage,
  prepareSend,
} from "~/lib/privacy/live";
import type { PrivacyReviewItem } from "~/lib/streamClient";
import type { InputField } from "~/lib/registry/types";
import type { FormValues } from "~/lib/forms/values";
import { loc } from "~/lib/i18n/localized";
import type { Locale } from "~/lib/i18n";

/** The gate sent nothing yet: its words, and how to send again once the teacher chose. */
export interface PrivacyAsk {
  items: PrivacyReviewItem[];
  retry: () => void;
}

/** The kinds of field whose text goes to the AI as the teacher typed it. */
const TEXT_KINDS: ReadonlySet<InputField["kind"]> = new Set([
  "text",
  "textarea",
  "file",
  "document",
]);

/** A tool's text fields as the preview shows them, with their labels. */
export function privacyFields(
  inputs: readonly InputField[],
  values: FormValues,
  locale: Locale,
): Array<LiveField & { label: string }> {
  return inputs
    .filter((f) => TEXT_KINDS.has(f.kind) && typeof values[f.name] === "string")
    .map((f) => ({
      name: f.name,
      label: loc(f.label, locale),
      text: String(values[f.name]),
      ...(f.redact ? { redact: true } : {}),
    }));
}

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const without = (list: readonly string[], word: string) =>
  list.filter((w) => norm(w) !== norm(word));

/** Saves or removes a never-list word; the list in the page already changed, so a failure is quiet. */
function persist(intent: "add" | "remove", word: string): void {
  if (typeof fetch !== "function") return;
  fetch("/api/privacy/keep", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent, word }),
  }).catch(() => {});
}

/**
 * The live preview's state for one tool page (anonymiseerpoort PR 3): what the teacher names
 * (page memory only), the words they keep, the never-list, and the gate's question. `prepare`
 * reads the latest choices, so a send right after a choice already carries it.
 */
export function usePrivacy(page: PrivacyPage | undefined) {
  const known = page?.known ?? { colleagues: [] };
  const [named, setNamedState] = useState<NamedPeople>(emptyNamed);
  const [pageKeep, setPageKeep] = useState<string[]>([]);
  const [never, setNever] = useState<string[]>(page?.never ?? []);
  const [approved, setApproved] = useState<string[]>([]);
  const [ask, setAsk] = useState<PrivacyAsk | null>(null);

  // The words the institution keeps (PR 5): fixed for the page; the gate reads them itself.
  const [shared] = useState<string[]>(page?.shared ?? []);
  const choices: LiveChoices = useMemo(
    () => ({ named, keep: [...pageKeep, ...never], shared, approved }),
    [named, pageKeep, never, shared, approved],
  );
  // The choices as they are after the last action, before React re-renders.
  const latest = useRef(choices);
  latest.current = choices;
  const update = (next: Partial<LiveChoices>) => {
    latest.current = { ...latest.current, ...next };
  };

  const setNamed = (next: NamedPeople) => {
    update({ named: next });
    setNamedState(next);
  };

  /** A word on the never-list (persisted) or only in this page. */
  const keepWord = (word: string, remember: boolean) => {
    if (remember && isKeepWord(word)) {
      const next = [...without(never, word), word.trim()];
      setNever(next);
      update({ keep: [...pageKeep, ...next] });
      persist("add", word);
    } else {
      const next = [...without(pageKeep, word), word.trim()];
      setPageKeep(next);
      update({ keep: [...next, ...never] });
    }
  };

  const forget = (word: string) => {
    const nextPage = without(pageKeep, word);
    const nextNever = without(never, word);
    setPageKeep(nextPage);
    if (nextNever.length !== never.length) {
      setNever(nextNever);
      persist("remove", word);
    }
    update({ keep: [...nextPage, ...nextNever] });
  };

  /**
   * One click on a mark: replaced → kept, kept → replaced again. A name the app knows goes on the
   * never-list; a pattern or a name the teacher gave stays in this page.
   */
  const toggle = (span: LiveSpan) => {
    if (span.kept) {
      forget(span.original);
      forget(span.value);
    } else keepWord(span.original, span.kind === "known");
  };

  /** "Ook vervangen": a word the teacher selected goes like a name they gave. */
  const alsoReplace = (word: string) => {
    const w = word.trim();
    if (!w) return;
    forget(w);
    const extra = latest.current.named.extra;
    setNamed({ ...latest.current.named, extra: extra ? `${extra}\n${w}` : w });
  };

  /** The teacher's answer to the gate: replace these, keep those; then send again. */
  const answer = (decisions: Record<string, "replace" | "keep">) => {
    if (!ask) return;
    const replace = ask.items.filter((i) => decisions[i.value] !== "keep").map((i) => i.value);
    const next = [...approved, ...replace];
    setApproved(next);
    update({ approved: next });
    for (const item of ask.items) {
      if (decisions[item.value] === "keep")
        keepWord(item.value, item.kind === "teacher" || item.kind === "colleague");
    }
    const { retry } = ask;
    setAsk(null);
    retry();
  };

  return {
    named,
    setNamed,
    never,
    forget,
    toggle,
    alsoReplace,
    ask,
    askFirst: (items: PrivacyReviewItem[], retry: () => void) => setAsk({ items, retry }),
    answer,
    cancelAsk: () => setAsk(null),
    preview: <F extends LiveField>(fields: readonly F[]) => livePreview(fields, known, choices),
    prepare: (input: Parameters<typeof prepareSend>[0]) =>
      prepareSend(input, known, latest.current),
  };
}

export type Privacy = ReturnType<typeof usePrivacy>;
