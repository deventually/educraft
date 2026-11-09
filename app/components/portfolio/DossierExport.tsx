import { Button } from "~/components/ui";
import { ReadinessSummaryLink } from "~/components/portfolio/ReadinessCheck";
import type { ReadinessItem } from "~/lib/portfolio/readiness";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

/**
 * Word export of the whole dossier (25.6): a plain GET form, works without JS. While an open
 * spot is left it offers only the draft version, and says why (BESLUIT-2026-11-07-4).
 */
export function DossierExport({
  dossierId,
  readiness,
  open,
  aiUsed,
  aiRequired,
}: {
  dossierId: string;
  readiness: ReadinessItem[];
  /** Open spots left in the whole dossier. */
  open: number;
  aiUsed: boolean;
  aiRequired: boolean;
}) {
  const t = useT();
  return (
    <form
      id="export"
      method="get"
      action={`/portfolio/${dossierId}/export`}
      className="mt-4 flex flex-wrap items-center gap-3"
      aria-label={t.portfolio.exportTitle}
    >
      <ReadinessSummaryLink items={readiness} />
      {aiUsed && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="ai" value="1" defaultChecked={aiRequired} />
          {t.portfolio.exportAi}
        </label>
      )}
      {open > 0 ? (
        <>
          {/* An open spot never reaches the handed-in work (BESLUIT-2026-11-07-4). */}
          <p className="w-full text-sm text-slate-800">
            {fmt(open === 1 ? t.portfolio.exportBlocked : t.portfolio.exportBlockedMany, {
              n: open,
            })}{" "}
            <a
              href="#readiness"
              className="font-medium text-violet-700 underline underline-offset-2"
            >
              {t.portfolio.exportBlockedLink}
            </a>
          </p>
          <Button
            type="submit"
            name="draft"
            value="1"
            variant="secondary"
            size="sm"
            aria-describedby="export-draft-help"
          >
            {t.portfolio.exportDraftWord}
          </Button>
          <Button
            type="submit"
            name="draft"
            value="1"
            formAction={`/portfolio/${dossierId}/print`}
            formTarget="_blank"
            variant="secondary"
            size="sm"
            aria-describedby="export-draft-help"
          >
            {t.portfolio.exportDraftPdf}
          </Button>
          <p id="export-draft-help" className="w-full text-sm text-slate-600">
            {t.portfolio.exportDraftHelp}
          </p>
        </>
      ) : (
        <>
          <Button type="submit" variant="secondary" size="sm">
            {t.portfolio.exportWord}
          </Button>
          <Button
            type="submit"
            formAction={`/portfolio/${dossierId}/print`}
            formTarget="_blank"
            variant="secondary"
            size="sm"
          >
            {t.portfolio.exportPdf}
          </Button>
        </>
      )}
      {aiUsed && aiRequired && (
        <p className="w-full text-sm text-slate-600">{t.portfolio.exportAiRequired}</p>
      )}
    </form>
  );
}

/**
 * One learning outcome handed in on its own (Word or PDF). While it has an open spot
 * the links give the draft version, and say so (BESLUIT-2026-11-07-4).
 */
export function PartExport({
  dossierId,
  outcomeId,
  label,
  open,
  ai,
}: {
  dossierId: string;
  outcomeId: string;
  label: string;
  open: number;
  /** The form asks for the AI disclosure and AI was used: always include it. */
  ai: boolean;
}) {
  const t = useT().portfolio.part;
  const query = `?lu=${encodeURIComponent(outcomeId)}${open > 0 ? "&draft=1" : ""}${ai ? "&ai=1" : ""}`;
  const link = "font-medium text-violet-700 underline underline-offset-2";
  return (
    <fieldset className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <legend className="sr-only">{fmt(t.label, { outcome: label })}</legend>
      <span className={open > 0 ? "font-medium text-amber-800" : "text-slate-700"}>
        {open > 0 ? fmt(open === 1 ? t.draftOne : t.draft, { n: open }) : t.final}
      </span>
      <a href={`/portfolio/${dossierId}/export${query}`} className={link}>
        {open > 0 ? t.wordDraft : t.word}
      </a>
      <a
        href={`/portfolio/${dossierId}/print${query}`}
        target="_blank"
        rel="noopener"
        className={link}
      >
        {open > 0 ? t.pdfDraft : t.pdf}
      </a>
    </fieldset>
  );
}
