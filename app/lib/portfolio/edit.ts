/**
 * Pure, immutable dossier edits. Every function returns a new DossierData and
 * leaves its input untouched. A change to the framework (outcomes, criteria)
 * clears `confirmedAt`: the teacher must look at the framework again.
 */
import type { CriterionStatus, DossierData, EvidenceItem, Framework, Outcome } from "./types";
import { applySuggestion } from "./proofread";

const newId = (): string => crypto.randomUUID();

function clone(d: DossierData): DossierData {
  return structuredClone(d);
}

function unconfirm(f: Framework): Framework {
  const { confirmedAt: _drop, provisional: _provisional, ...rest } = f;
  return rest;
}

function allCriterionIds(d: DossierData): Set<string> {
  return new Set(d.framework.outcomes.flatMap((o) => o.criteria.map((c) => c.id)));
}

function assertCriteria(d: DossierData, ids: string[]): void {
  const known = allCriterionIds(d);
  for (const id of ids) if (!known.has(id)) throw new Error(`Unknown criterion: ${id}`);
}

function mapOutcome(d: DossierData, outcomeId: string, fn: (o: Outcome) => Outcome): DossierData {
  if (!d.framework.outcomes.some((o) => o.id === outcomeId))
    throw new Error(`Unknown outcome: ${outcomeId}`);
  const next = clone(d);
  next.framework = unconfirm({
    ...next.framework,
    outcomes: next.framework.outcomes.map((o) => (o.id === outcomeId ? fn(o) : o)),
  });
  return next;
}

/** Drops statuses and evidence links that point at criteria no longer in the framework. */
function prune(d: DossierData): DossierData {
  const known = allCriterionIds(d);
  const outcomes = new Set(d.framework.outcomes.map((o) => o.id));
  d.status = Object.fromEntries(Object.entries(d.status).filter(([id]) => known.has(id)));
  d.evidence = d.evidence.map((e) => ({
    ...e,
    criterionIds: e.criterionIds.filter((id) => known.has(id)),
  }));
  d.chapters = d.chapters.filter((ch) => outcomes.has(ch.outcomeId));
  if (d.reviews)
    d.reviews = Object.fromEntries(Object.entries(d.reviews).filter(([id]) => outcomes.has(id)));
  if (d.proofreads)
    d.proofreads = Object.fromEntries(
      Object.entries(d.proofreads).filter(([id]) => outcomes.has(id)),
    );
  if (d.anchors)
    d.anchors = Object.fromEntries(Object.entries(d.anchors).filter(([id]) => outcomes.has(id)));
  return d;
}

// ── Framework ───────────────────────────────────────────────────────────────

export function addOutcome(
  d: DossierData,
  input: { code: string; title: string; requiredEvidence?: string[] },
): DossierData {
  const next = clone(d);
  next.framework = unconfirm({
    ...next.framework,
    outcomes: [
      ...next.framework.outcomes,
      {
        id: newId(),
        code: input.code,
        title: input.title,
        criteria: [],
        requiredEvidence: input.requiredEvidence ?? [],
      },
    ],
  });
  return next;
}

export function updateOutcome(
  d: DossierData,
  outcomeId: string,
  patch: Partial<Pick<Outcome, "code" | "title" | "requiredEvidence">>,
): DossierData {
  return mapOutcome(d, outcomeId, (o) => ({ ...o, ...patch }));
}

export function removeOutcome(d: DossierData, outcomeId: string): DossierData {
  const next = clone(d);
  next.framework = unconfirm({
    ...next.framework,
    outcomes: next.framework.outcomes.filter((o) => o.id !== outcomeId),
  });
  return prune(next);
}

export function addCriterion(
  d: DossierData,
  outcomeId: string,
  input: { text: string; strongLevel?: string },
): DossierData {
  return mapOutcome(d, outcomeId, (o) => ({
    ...o,
    criteria: [...o.criteria, { id: newId(), ...input }],
  }));
}

export function updateCriterion(
  d: DossierData,
  criterionId: string,
  patch: { text?: string; strongLevel?: string },
): DossierData {
  assertCriteria(d, [criterionId]);
  const owner = d.framework.outcomes.find((o) => o.criteria.some((c) => c.id === criterionId));
  return mapOutcome(d, (owner as Outcome).id, (o) => ({
    ...o,
    criteria: o.criteria.map((c) => {
      if (c.id !== criterionId) return c;
      // The teacher has looked at it: drop the extraction's "check this" flag.
      const { unverified: _checked, ...rest } = c;
      return { ...rest, ...patch };
    }),
  }));
}

export function removeCriterion(d: DossierData, criterionId: string): DossierData {
  const next = clone(d);
  next.framework = unconfirm({
    ...next.framework,
    outcomes: next.framework.outcomes.map((o) => ({
      ...o,
      criteria: o.criteria.filter((c) => c.id !== criterionId),
    })),
  });
  return prune(next);
}

export function updateFrameworkMeta(
  d: DossierData,
  patch: Partial<Pick<Framework, "institution" | "year" | "requirements">>,
): DossierData {
  const next = clone(d);
  next.framework = unconfirm({ ...next.framework, ...patch });
  return next;
}

export function confirmFramework(d: DossierData, at: number): DossierData {
  const next = clone(d);
  next.framework = { ...unconfirm(next.framework), confirmedAt: at };
  return next;
}

/** Confirms the national starting point as a stand-in until the institution's form is in. */
export function confirmProvisional(d: DossierData, at: number): DossierData {
  if (!d.framework.national) throw new Error("Only the national starting point is provisional");
  const next = clone(d);
  next.framework = { ...next.framework, confirmedAt: at, provisional: true };
  return next;
}

// ── Teacher-owned status ────────────────────────────────────────────────────

export function setStatus(
  d: DossierData,
  criterionId: string,
  status: CriterionStatus,
): DossierData {
  assertCriteria(d, [criterionId]);
  const next = clone(d);
  if (status === "not-started") delete next.status[criterionId];
  else next.status[criterionId] = status;
  return next;
}

// ── Evidence ────────────────────────────────────────────────────────────────

export function addEvidence(d: DossierData, input: Omit<EvidenceItem, "id">): DossierData {
  assertCriteria(d, input.criterionIds);
  const next = clone(d);
  next.evidence.push({ id: newId(), ...input, criterionIds: [...input.criterionIds] });
  return next;
}

export function updateEvidence(
  d: DossierData,
  evidenceId: string,
  patch: Partial<Omit<EvidenceItem, "id">>,
): DossierData {
  if (patch.criterionIds) assertCriteria(d, patch.criterionIds);
  if (!d.evidence.some((e) => e.id === evidenceId))
    throw new Error(`Unknown evidence: ${evidenceId}`);
  const next = clone(d);
  next.evidence = next.evidence.map((e) => (e.id === evidenceId ? { ...e, ...patch } : e));
  return next;
}

export function removeEvidence(d: DossierData, evidenceId: string): DossierData {
  const next = clone(d);
  next.evidence = next.evidence.filter((e) => e.id !== evidenceId);
  return next;
}

// ── Chapters (one per outcome) ──────────────────────────────────────────────

/** Writes the chapter for an outcome, creating it on first write. */
export function writeChapter(
  d: DossierData,
  outcomeId: string,
  text: string,
  opts: { aiDrafted?: boolean } = {},
): DossierData {
  if (!d.framework.outcomes.some((o) => o.id === outcomeId))
    throw new Error(`Unknown outcome: ${outcomeId}`);
  const next = clone(d);
  const existing = next.chapters.find((ch) => ch.outcomeId === outcomeId);
  if (existing) {
    existing.text = text;
    existing.aiDrafted = existing.aiDrafted || !!opts.aiDrafted;
  } else {
    next.chapters.push({ id: newId(), outcomeId, text, aiDrafted: !!opts.aiDrafted });
  }
  return next;
}

/** Updates a chapter by its own id. */
export function updateChapter(d: DossierData, chapterId: string, text: string): DossierData {
  const chapter = d.chapters.find((ch) => ch.id === chapterId);
  if (!chapter) throw new Error(`Unknown chapter: ${chapterId}`);
  return writeChapter(d, chapter.outcomeId, text);
}

// ── Proofreading ────────────────────────────────────────────────────────────

function withoutProposal(d: DossierData, outcomeId: string, index: number): DossierData {
  const stored = d.proofreads?.[outcomeId];
  if (!stored?.suggestions[index]) throw new Error(`Unknown proposal: ${outcomeId}#${index}`);
  return {
    ...d,
    proofreads: {
      ...d.proofreads,
      [outcomeId]: { ...stored, suggestions: stored.suggestions.filter((_, i) => i !== index) },
    },
  };
}

/** Takes one proofreading proposal over into the chapter: exactly its span is replaced. */
export function takeProofread(d: DossierData, outcomeId: string, index: number): DossierData {
  const proposal = d.proofreads?.[outcomeId]?.suggestions[index];
  if (!proposal) throw new Error(`Unknown proposal: ${outcomeId}#${index}`);
  const chapter = d.chapters.find((ch) => ch.outcomeId === outcomeId)?.text ?? "";
  const text = applySuggestion(chapter, proposal);
  if (text === null) throw new Error(`Unknown span: ${outcomeId}#${index}`);
  return writeChapter(withoutProposal(d, outcomeId, index), outcomeId, text);
}

/** Ignores one proofreading proposal: it leaves the list, the chapter stays. */
export function skipProofread(d: DossierData, outcomeId: string, index: number): DossierData {
  return withoutProposal(d, outcomeId, index);
}

// ── References ──────────────────────────────────────────────────────────────

export function addReference(d: DossierData, apa: string): DossierData {
  const next = clone(d);
  next.references.push({ id: newId(), apa });
  return next;
}

export function removeReference(d: DossierData, referenceId: string): DossierData {
  const next = clone(d);
  next.references = next.references.filter((r) => r.id !== referenceId);
  return next;
}
