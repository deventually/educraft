import { useId } from "react";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { WordDownload } from "~/components/export/WordDownload";
import { Card } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmtDate } from "~/lib/portfolio/format";
import { purgeDate, trackLine } from "~/lib/tracks";

/**
 * Closing a track (brief P38.7): closing sets when it is wiped; the teacher sees that date and can
 * take the whole line along as Word, made in the browser, which is then their responsibility.
 */
export function CloseTrack({
  track,
  retentionDays,
  rounds,
  onstage,
}: {
  track: { code: string; closedAt: Date | null; purgeAfter: Date | null };
  retentionDays: number;
  rounds: readonly { milestone: string; round: number; feedback: { text: string } }[];
  onstage: readonly { criterion: string; text: string }[];
}) {
  const t = useT();
  const m = t.tracks.close;
  const locale = useLocale();
  const id = useId();
  const date = (d: Date) => fmtDate(d, locale);
  const purge = date(purgeDate(new Date(), retentionDays));
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-base font-medium text-slate-900">
        {m.heading}
      </h3>
      <Card className="mt-2 space-y-3 p-4">
        <p className="max-w-[65ch] text-sm text-slate-700">
          {track.closedAt
            ? fmt(m.closedOn, {
                date: date(track.closedAt),
                purge: track.purgeAfter ? date(track.purgeAfter) : "–",
              })
            : fmt(m.intro, { days: retentionDays })}
        </p>
        <p className="max-w-[65ch] text-sm text-slate-600">{m.keepNote}</p>
        <div className="flex flex-wrap items-center gap-2">
          <WordDownload
            markdown={trackLine({ rounds, onstage }, locale)}
            title={fmt(t.tracks.title, { code: track.code })}
            lang={locale}
          />
          {!track.closedAt && (
            <ConfirmDialog
              triggerLabel={m.button}
              triggerSize="sm"
              title={m.confirmTitle}
              description={fmt(m.confirmBody, { purge })}
              confirmLabel={m.button}
              cancelLabel={t.confirm.cancel}
              fields={{ intent: "close" }}
            />
          )}
        </div>
      </Card>
    </section>
  );
}
