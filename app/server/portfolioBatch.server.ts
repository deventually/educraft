/**
 * Evidence in one go, the server half: one model call per file for a proposal (stored
 * nowhere; the page shows it for the teacher to confirm), and adding what the teacher ticked
 * in one save. Pure checks live in `~/lib/portfolio/batch`.
 */
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
import { getMessages, type Locale } from "~/lib/i18n";
import type { User } from "./auth.server";
import { callPortfolioModel, quotaGate } from "./portfolioAi.server";
import { updateDossier, type Dossier } from "./repositories/portfolio.server";

/** Files sorted at the same time: quick for 25 files, gentle on the provider. */
const PARALLEL = 4;

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
  const proposals: SortProposal[] = [];
  for (let i = 0; i < files.length; i += PARALLEL) {
    const chunk = files.slice(i, i + PARALLEL);
    const answers = await Promise.all(
      chunk.map((f) =>
        callPortfolioModel(
          user,
          SORT_PROMPT_ID,
          buildSortMessage(d, f, locale),
          locale,
          600,
          "portfolio-sort",
        ),
      ),
    );
    for (const [j, f] of chunk.entries())
      proposals.push(parseSortAnswer(answers[j]?.text ?? null, d, f));
  }
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
