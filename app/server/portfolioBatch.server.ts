/**
 * Evidence in one go, the server half: one model call per file for a proposal (stored
 * nowhere; the page shows it for the teacher to confirm), and adding what the teacher ticked
 * in one save. Pure checks live in `~/lib/portfolio/batch`; with Jev's switch on
 * (`jevAccess`), TypeSafe's Jev sorts a file first (`~/lib/portfolio/sortJev`).
 */
import { postDecisions } from "~/lib/ai/decisions";
import { usdInEuroMicros } from "~/lib/ai/models";
import {
  addEvidenceBatch,
  type BatchFile,
  BatchFilesSchema,
  BatchItemsSchema,
  buildSortMessage,
  parseSortAnswer,
  SORT_PROMPT_ID,
  type SortProposal,
} from "~/lib/portfolio/batch";
import { DossierDataSchema } from "~/lib/portfolio/schema";
import type { DossierData } from "~/lib/portfolio/types";
import { buildJevRequest, parseJevAnswer } from "~/lib/portfolio/sortJev";
import { getMessages, type Locale } from "~/lib/i18n";
import { currentAiSignal } from "./aiCalls.server";
import type { User } from "./auth.server";
import { jevAccess } from "./jev.server";
import { callPortfolioModel, quotaGate } from "./portfolioAi.server";
import { recordAiUsage } from "./repositories/aiUsage.server";
import { updateDossier, type Dossier } from "./repositories/portfolio.server";

/** Files sorted at the same time: quick for 25 files, gentle on the provider. */
const PARALLEL = 4;

const EVENT = "portfolio-sort";

type Sorter = (f: BatchFile) => Promise<SortProposal | null>;

/**
 * Jev's sort of one file (Jev's switch, off by default), each criterion asked whole: `null` when
 * Jev did not answer, so the LLM sorts that file. Nothing goes to Jev unless `jevAccess` allows
 * it; each call is metered at the cost Jev reports.
 */
async function jevSorter(user: User, d: DossierData, locale: Locale): Promise<Sorter | null> {
  const jev = await jevAccess();
  if (!jev) return null;
  const { url, model, provider, apiKey } = jev;
  const signal = currentAiSignal();
  return async (f) => {
    const answer = await postDecisions(url, buildJevRequest(d, f, locale, { model }), {
      apiKey,
      ...(signal ? { signal } : {}),
    }).then(
      (body) => parseJevAnswer(body, d, f),
      () => null,
    );
    const costMicros = answer?.costUsd === undefined ? undefined : usdInEuroMicros(answer.costUsd);
    await recordAiUsage(user.id, {
      source: EVENT,
      model,
      provider,
      failed: !answer?.usable,
      ...(costMicros === undefined ? {} : { costMicros }),
    }).catch((e: unknown) => console.error("Failed to record usage:", e));
    return answer?.usable ? answer.proposal : null;
  };
}

type ProposeResult =
  | { ok: true; proposals: SortProposal[] }
  | { ok: false; error: "not-confirmed" | "quota" };

/** A proposal per file, in the files' order. A failed call still gives a row to check. */
async function proposeEvidence(
  user: User,
  d: DossierData,
  files: readonly BatchFile[],
  locale: Locale,
): Promise<ProposeResult> {
  if (d.framework.confirmedAt === undefined) return { ok: false, error: "not-confirmed" };
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };
  const jev = await jevSorter(user, d, locale);
  const llm = async (f: BatchFile): Promise<SortProposal> => {
    const answer = await callPortfolioModel(
      user,
      SORT_PROMPT_ID,
      buildSortMessage(d, f, locale),
      locale,
      600,
      EVENT,
    );
    return parseSortAnswer(answer?.text ?? null, d, f);
  };
  const sort = async (f: BatchFile) => (await jev?.(f)) ?? (await llm(f));
  const proposals: SortProposal[] = [];
  for (let i = 0; i < files.length; i += PARALLEL)
    proposals.push(...(await Promise.all(files.slice(i, i + PARALLEL).map(sort))));
  return { ok: true, proposals };
}

export type BatchActionResult =
  | { ok: true; intent: "proposeEvidence"; sorted: SortProposal[] }
  | { ok: true; intent: "addEvidenceBatch"; added: number }
  | { ok: false; error: string };

/** `proposeEvidence` and `addEvidenceBatch`; `null` for any other intent. */
export async function runBatchIntent(
  user: User,
  dossier: Dossier,
  intent: string,
  fd: FormData,
  locale: Locale,
): Promise<BatchActionResult | null> {
  const m = getMessages(locale);
  if (intent === "proposeEvidence") {
    const files = BatchFilesSchema.safeParse(fd.get("files"));
    if (!files.success) return { ok: false, error: m.portfolio.errorInvalid };
    const r = await proposeEvidence(user, dossier.data, files.data, locale);
    if (!r.ok) return { ok: false, error: m.portfolioBatch.errors[r.error] };
    return { ok: true, intent, sorted: r.proposals };
  }
  if (intent === "addEvidenceBatch") {
    const items = BatchItemsSchema.safeParse(fd.get("items"));
    if (!items.success) return { ok: false, error: m.portfolio.errorInvalid };
    let next: DossierData;
    try {
      next = addEvidenceBatch(dossier.data, items.data);
    } catch {
      return { ok: false, error: m.portfolio.errorInvalid };
    }
    if (!DossierDataSchema.safeParse(next).success)
      return { ok: false, error: m.portfolio.errorInvalid };
    await updateDossier(user.id, dossier.id, { data: next });
    return { ok: true, intent, added: items.data.length };
  }
  return null;
}
