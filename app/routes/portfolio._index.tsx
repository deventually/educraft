import { Form, Link, useActionData } from "react-router";
import { BookOpenCheck, Trash2 } from "lucide-react";
import type { Route } from "./+types/portfolio._index";
import { createDossier, deleteDossier, listDossiers } from "~/server/repositories/portfolio.server";
import { requirePortfolioUser } from "~/server/portfolio.server";
import { emptyDossier, LIMITS } from "~/lib/portfolio/schema";
import { outcomeProgress } from "~/lib/portfolio/progress";
import { TRACKS, type Track } from "~/lib/portfolio/types";
import { Button, Card, Input, Label } from "~/components/ui";
import { EmptyState } from "~/components/EmptyState";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { useFormToast } from "~/components/Toast";
import { useLocale, useT } from "~/lib/i18n/useT";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { fmt } from "~/lib/i18n/format";
import { fmtDate } from "~/lib/portfolio/format";

export function meta() {
  return [{ title: "BDB/BKE — LimeOnIt" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requirePortfolioUser(request);
  const dossiers = (await listDossiers(user.id)).map((d) => {
    const progress = outcomeProgress(d.data);
    return {
      id: d.id,
      name: d.name,
      tracks: d.data.tracks,
      shown: progress.reduce((n, p) => n + p.shown, 0),
      total: progress.reduce((n, p) => n + p.criteria, 0),
      updatedAt: d.updatedAt,
    };
  });
  return { dossiers };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requirePortfolioUser(request);
  const fd = await request.formData();
  const m = getMessages(getLocale(request));
  const intent = fd.get("intent");
  if (intent === "delete") {
    const deleted = await deleteDossier(user.id, String(fd.get("id") ?? ""));
    return deleted
      ? { ok: true as const, intent: "delete" }
      : { ok: false as const, error: m.portfolio.errorNotFound };
  }
  if (intent === "create") {
    const name = String(fd.get("name") ?? "").trim();
    if (!name || name.length > LIMITS.name)
      return { ok: false as const, error: m.portfolio.errorName };
    const tracks = TRACKS.filter((t) => fd.getAll("tracks").includes(t));
    if (tracks.length === 0) return { ok: false as const, error: m.portfolio.errorTracks };
    const dossier = await createDossier(user.id, name, emptyDossier(tracks));
    return { ok: true as const, intent: "create", id: dossier.id };
  }
  return { ok: false as const, error: m.portfolio.errorInvalid };
}

export default function PortfolioList({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const actionData = useActionData<typeof action>();
  const { dossiers } = loaderData;
  useFormToast(actionData, {
    result: (d) => {
      if (!d) return null;
      if (!d.ok) return { variant: "error", message: d.error };
      return {
        variant: "success",
        message: d.intent === "delete" ? t.portfolio.toastDeleted : t.portfolio.toastCreated,
      };
    },
  });
  const trackLabel: Record<Track, string> = { bdb: "BDB", bke: "BKE" };

  return (
    <div className="w-full min-w-0">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {t.portfolio.heading}
      </h1>
      <p className="mt-2 text-slate-600">{t.portfolio.intro}</p>

      <Card className="mt-6 p-5">
        <h2 className="text-lg font-medium text-slate-900">{t.portfolio.createTitle}</h2>
        <Form method="post" className="mt-4 space-y-4">
          <input type="hidden" name="intent" value="create" />
          <div>
            <Label htmlFor="dossier-name">{t.portfolio.nameLabel}</Label>
            <Input
              id="dossier-name"
              name="name"
              required
              maxLength={LIMITS.name}
              placeholder={t.portfolio.namePlaceholder}
            />
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">
              {t.portfolio.tracksLegend}
            </legend>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="tracks" value="bdb" defaultChecked />
                {t.portfolio.trackBdb}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="tracks" value="bke" />
                {t.portfolio.trackBke}
              </label>
            </div>
          </fieldset>
          <Button type="submit">{t.portfolio.create}</Button>
        </Form>
      </Card>

      {dossiers.length === 0 ? (
        <EmptyState
          icon={<BookOpenCheck aria-hidden />}
          title={t.portfolio.emptyTitle}
          body={t.portfolio.emptyBody}
          action={{
            label: t.portfolio.createTitle,
            onClick: () => document.getElementById("dossier-name")?.focus(),
          }}
        />
      ) : (
        <section className="mt-8" aria-labelledby="dossier-list">
          <h2 id="dossier-list" className="text-lg font-medium text-slate-900">
            {t.portfolio.listTitle}
          </h2>
          <ul className="mt-3 space-y-3">
            {dossiers.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <Link
                    to={`/portfolio/${d.id}`}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    {d.name}
                  </Link>
                  <p className="text-sm text-slate-600">
                    {d.tracks.map((tr) => trackLabel[tr]).join(" + ")} ·{" "}
                    {fmt(t.portfolio.progressSummary, { shown: d.shown, total: d.total })}
                  </p>
                  <p className="text-xs text-slate-500">
                    {fmt(t.portfolio.updated, { date: fmtDate(d.updatedAt, locale) })}
                  </p>
                </div>
                <ConfirmDialog
                  triggerLabel={`${t.portfolio.delete}: ${d.name}`}
                  triggerIcon={<Trash2 className="size-4" aria-hidden />}
                  triggerIconOnly
                  title={t.portfolio.deleteTitle}
                  description={t.portfolio.deleteBody}
                  confirmLabel={t.portfolio.delete}
                  cancelLabel={t.confirm.cancel}
                  fields={{ intent: "delete", id: d.id }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
