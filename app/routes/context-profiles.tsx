import { useEffect, useState } from "react";
import { Form, useActionData, useNavigation } from "react-router";
import { Trash2, Plus, Pencil, Wand2, PenLine, ArrowLeft } from "lucide-react";
import type { Route } from "./+types/context-profiles";
import {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  getDefaultProfile,
} from "~/server/repositories/profiles.server";
import { requireUser } from "~/server/auth.server";
import type { ContextProfile } from "~/lib/context/types";
import { parseContextForm } from "~/lib/context/parseForm";
import { Button, Card, Badge } from "~/components/ui";
import { ContextWizard } from "~/components/context/ContextWizard";
import { ContextForm } from "~/components/context/ContextForm";
import { useT } from "~/lib/i18n/useT";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return {
    profiles: await listProfiles(user.id),
    defaultId: (await getDefaultProfile(user.id))?.id ?? "",
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const fd = await request.formData();
  const intent = fd.get("intent");

  if (intent === "delete") {
    await deleteProfile(user.id, String(fd.get("id")));
    return { ok: true };
  }

  if (intent === "create" || intent === "update") {
    const { input, isDefault, error } = parseContextForm(fd);
    if (error || !input) {
      const m = getMessages(getLocale(request));
      return { ok: false, error: m.settings.nameRequired };
    }
    if (intent === "update") {
      const id = String(fd.get("id") ?? "");
      if (id) await updateProfile(user.id, id, input, isDefault);
    } else {
      await createProfile(user.id, input, isDefault);
    }
    return { ok: true };
  }

  return { ok: false };
}

type CreateMode = "choose" | "wizard" | "form";

export default function Settings({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const { profiles, defaultId } = loaderData;
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const [mode, setMode] = useState<CreateMode>("choose");
  const [editing, setEditing] = useState<ContextProfile | null>(null);

  // After any successful submit, collapse back to the choice so the next
  // action starts from a clean slate.
  useEffect(() => {
    if (actionData?.ok) {
      setMode("choose");
      setEditing(null);
    }
  }, [actionData]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {t.settings.heading}
      </h1>
      <p className="mt-2 text-slate-600">{t.settings.intro}</p>

      <section className="mt-6 space-y-3">
        {profiles.length === 0 && <p className="text-sm text-slate-500">{t.settings.empty}</p>}
        {profiles.map((p) => (
          <Card
            key={p.id}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-900">{p.name}</p>
                {p.domain && <Badge>{p.domain}</Badge>}
                {p.eqf && <Badge>EQF {p.eqf}</Badge>}
                {p.id === defaultId && <Badge>{t.settings.defaultBadge}</Badge>}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {[p.programme, p.courseName, p.tools].filter(Boolean).join(" · ")}
              </p>
              {p.competencies && (
                <p className="mt-1 line-clamp-2 text-xs text-slate-400">{p.competencies}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => setEditing(p)}
              >
                <Pencil className="size-4" aria-hidden /> {t.settings.edit}
              </Button>
              <Form method="post">
                <input type="hidden" name="id" value={p.id} />
                <Button
                  type="submit"
                  name="intent"
                  value="delete"
                  variant="danger"
                  size="sm"
                  disabled={busy}
                >
                  <Trash2 className="size-4" aria-hidden /> {t.settings.delete}
                </Button>
              </Form>
            </div>
          </Card>
        ))}
      </section>

      <Card className="mt-8 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            {editing ? (
              <>
                <Pencil className="size-4 text-violet-600" aria-hidden /> {t.settings.editProfile}
              </>
            ) : (
              <>
                <Plus className="size-4 text-violet-600" aria-hidden /> {t.settings.newProfile}
              </>
            )}
          </h2>
          {(editing || mode !== "choose") && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(null);
                setMode("choose");
              }}
            >
              <ArrowLeft className="size-4" aria-hidden /> {t.settings.cancel}
            </Button>
          )}
        </div>

        {actionData && !actionData.ok && actionData.error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionData.error}
          </p>
        )}

        {editing ? (
          <ContextForm
            key={editing.id}
            profile={editing}
            isCurrentDefault={editing.id === defaultId}
            onCancel={() => setEditing(null)}
          />
        ) : mode === "choose" ? (
          <div>
            <p className="text-sm text-slate-600">{t.settings.chooseIntro}</p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("wizard")}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-violet-400 hover:bg-violet-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <Wand2 className="mt-0.5 size-5 shrink-0 text-violet-600" aria-hidden />
                <span>
                  <span className="block font-medium text-slate-900">{t.settings.useWizard}</span>
                  <span className="mt-0.5 block text-sm text-slate-500">
                    {t.settings.useWizardDesc}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode("form")}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-violet-400 hover:bg-violet-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <PenLine className="mt-0.5 size-5 shrink-0 text-violet-600" aria-hidden />
                <span>
                  <span className="block font-medium text-slate-900">{t.settings.useForm}</span>
                  <span className="mt-0.5 block text-sm text-slate-500">
                    {t.settings.useFormDesc}
                  </span>
                </span>
              </button>
            </div>
          </div>
        ) : mode === "wizard" ? (
          <ContextWizard onCancel={() => setMode("choose")} />
        ) : (
          <ContextForm onCancel={() => setMode("choose")} />
        )}
      </Card>
    </div>
  );
}
