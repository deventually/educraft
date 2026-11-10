/**
 * Assessment models: the teacher's frameworks (with or without a scale) per document type,
 * filled into the assessment tool. Starters can be copied; an own rubric can be taken over.
 */
import { useEffect, useState } from "react";
import { Form, useActionData, useNavigation } from "react-router";
import { ArrowLeft, ClipboardCheck, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import type { Route } from "./+types/assessment-models";
import { requireUser } from "~/server/auth.server";
import {
  createAssessmentModel,
  deleteAssessmentModel,
  listAssessmentModels,
  updateAssessmentModel,
} from "~/server/repositories/assessmentModels.server";
import { getRubric, listRubrics } from "~/server/repositories/rubrics.server";
import { ASSESSMENT_MODEL_LIMITS, STARTER_MODELS } from "~/lib/assessment-models";
import { rubricToMarkdown } from "~/lib/utilities/rubric";
import { ALL_TOOLS } from "~/lib/registry";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { loc } from "~/lib/i18n/localized";
import { useT } from "~/lib/i18n/useT";
import { Badge, Button, Card, Label, Select } from "~/components/ui";
import { EmptyState } from "~/components/EmptyState";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { useFormToast } from "~/components/Toast";
import {
  AssessmentModelEditor,
  type EditableModel,
} from "~/components/assessment-models/AssessmentModelEditor";

/** The document types a model can be for: the options of every tool's `byField`. */
function documentTypes(locale: "nl" | "en") {
  const out = new Map<string, string>();
  for (const tool of ALL_TOOLS) {
    const by = tool.assessmentModels?.byField;
    const field = tool.inputs.find((f) => f.name === by);
    for (const o of field?.options ?? []) out.set(o.value, loc(o.label, locale));
  }
  return [...out].map(([value, label]) => ({ value, label }));
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const locale = getLocale(request);
  const [models, rubrics] = await Promise.all([
    listAssessmentModels(user.id),
    listRubrics(user.id),
  ]);
  return {
    models,
    starters: STARTER_MODELS.map((s) => ({
      id: s.id,
      name: s.name[locale],
      documentTypes: s.documentTypes,
      scale: s.scale[locale],
    })),
    rubrics: rubrics.map((r) => ({ id: r.id, name: r.name })),
    documentTypes: documentTypes(locale),
  };
}

type Intent = "create" | "update" | "delete" | "copy-starter" | "from-rubric";
type Failure = "name" | "framework" | "documentType" | "notFound";
const ok = (intent: Intent) => ({ ok: true as const, intent });
const fail = (error: Failure) => ({ ok: false as const, error });

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const locale = getLocale(request);
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");
  const id = String(fd.get("id") ?? "");

  if (intent === "delete") {
    return (await deleteAssessmentModel(user.id, id)) ? ok("delete") : fail("notFound");
  }

  if (intent === "copy-starter") {
    const starter = STARTER_MODELS.find((s) => s.id === fd.get("starter"));
    if (!starter) return fail("notFound");
    await createAssessmentModel(user.id, starter.name[locale], {
      documentTypes: starter.documentTypes,
      framework: starter.framework[locale],
      scale: starter.scale[locale],
    });
    return ok("copy-starter");
  }

  if (intent === "from-rubric") {
    const rubric = await getRubric(user.id, String(fd.get("rubric") ?? ""));
    if (!rubric) return fail("notFound");
    const labels = getMessages(locale).utilities.rubric.export;
    await createAssessmentModel(user.id, rubric.name.slice(0, ASSESSMENT_MODEL_LIMITS.name), {
      documentTypes: [],
      framework: rubricToMarkdown(rubric.data, labels),
      scale: "",
    });
    return ok("from-rubric");
  }

  if (intent === "create" || intent === "update") {
    const name = String(fd.get("name") ?? "").trim();
    const framework = String(fd.get("framework") ?? "");
    const scale = String(fd.get("scale") ?? "");
    const types = fd.getAll("documentTypes").map(String);
    if (!name || name.length > ASSESSMENT_MODEL_LIMITS.name) return fail("name");
    if (!framework.trim() || framework.length > ASSESSMENT_MODEL_LIMITS.framework)
      return fail("framework");
    const known = new Set(documentTypes(locale).map((d) => d.value));
    if (types.some((t) => !known.has(t))) return fail("documentType");
    const data = { documentTypes: [...new Set(types)], framework, scale };
    if (intent === "create") {
      await createAssessmentModel(user.id, name, data);
      return ok("create");
    }
    return (await updateAssessmentModel(user.id, id, { name, data }))
      ? ok("update")
      : fail("notFound");
  }

  return fail("notFound");
}

export default function AssessmentModels({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const m = t.assessmentModels;
  const { models, starters, rubrics, documentTypes: types } = loaderData;
  const actionData = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";
  // null = list view; { model? } = the editor (create when model is undefined).
  const [editor, setEditor] = useState<{ model?: EditableModel } | null>(null);
  const typeLabel = new Map(types.map((d) => [d.value, d.label]));

  useEffect(() => {
    if (actionData?.ok) setEditor(null);
  }, [actionData]);

  const errors: Record<Failure, string> = {
    name: m.errorName,
    framework: m.errorFramework,
    documentType: m.errorDocumentType,
    notFound: m.errorNotFound,
  };
  useFormToast(actionData, {
    result: (d) => {
      if (!d) return null;
      if (!d.ok) return { variant: "error", message: errors[d.error] };
      const message =
        d.intent === "delete"
          ? m.toastDeleted
          : d.intent === "copy-starter" || d.intent === "from-rubric"
            ? m.toastCopied
            : m.toastSaved;
      return { variant: "success", message };
    },
  });

  const typesOf = (values: string[]) =>
    values.length === 0 ? [m.anyType] : values.map((v) => typeLabel.get(v) ?? v);

  return (
    <div className="w-full min-w-0">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {m.heading}
      </h1>
      <p className="mt-2 max-w-3xl text-slate-600">{m.intro}</p>

      {models.length === 0 && !editor && (
        <EmptyState
          icon={<ClipboardCheck aria-hidden />}
          title={m.emptyTitle}
          body={m.emptyBody}
          action={{ onClick: () => setEditor({}), label: m.newModel }}
        />
      )}

      <section className="mt-6 space-y-3">
        {models.map((model) => (
          <Card
            key={model.id}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{model.name}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {typesOf(model.data.documentTypes).map((label) => (
                  <Badge key={label}>{label}</Badge>
                ))}
                {!model.data.scale.trim() && <Badge>{m.feedbackOnly}</Badge>}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => setEditor({ model })}
              >
                <Pencil className="size-4" aria-hidden /> {m.edit}
              </Button>
              <ConfirmDialog
                triggerLabel={m.delete}
                triggerIcon={<Trash2 className="size-4" aria-hidden />}
                title={m.deleteTitle}
                description={m.deleteBody}
                confirmLabel={m.delete}
                cancelLabel={t.confirm.cancel}
                fields={{ intent: "delete", id: model.id }}
              />
            </div>
          </Card>
        ))}
      </section>

      {(models.length > 0 || editor) && (
        <Card className="mt-6 p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              {editor?.model ? (
                <Pencil className="size-4 text-violet-600" aria-hidden />
              ) : (
                <Plus className="size-4 text-violet-600" aria-hidden />
              )}
              {editor?.model ? m.editModel : m.newModel}
            </h2>
            {editor && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditor(null)}>
                <ArrowLeft className="size-4" aria-hidden /> {m.cancel}
              </Button>
            )}
          </div>
          {editor ? (
            <AssessmentModelEditor
              key={editor.model?.id ?? "new"}
              model={editor.model}
              documentTypes={types}
              onCancel={() => setEditor(null)}
            />
          ) : (
            <Button type="button" onClick={() => setEditor({})}>
              <Plus className="size-4" aria-hidden /> {m.newModel}
            </Button>
          )}
        </Card>
      )}

      <section className="mt-10" aria-labelledby="starters-heading">
        <h2 id="starters-heading" className="font-semibold text-slate-900">
          {m.starters}
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{m.startersIntro}</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {starters.map((s) => (
            <li key={s.id}>
              <Card className="flex h-full flex-col justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{s.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {typesOf(s.documentTypes).map((label) => (
                      <Badge key={label}>{label}</Badge>
                    ))}
                  </div>
                </div>
                <Form method="post">
                  <input type="hidden" name="intent" value="copy-starter" />
                  <input type="hidden" name="starter" value={s.id} />
                  <Button type="submit" variant="secondary" size="sm" disabled={busy}>
                    <Copy className="size-4" aria-hidden /> {m.copyStarter}
                    <span className="sr-only">: {s.name}</span>
                  </Button>
                </Form>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {rubrics.length > 0 && (
        <section className="mt-10" aria-labelledby="from-rubric-heading">
          <h2 id="from-rubric-heading" className="font-semibold text-slate-900">
            {m.fromRubric}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{m.fromRubricIntro}</p>
          <Form method="post" className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="intent" value="from-rubric" />
            <div className="min-w-0">
              <Label htmlFor="from-rubric" className="mb-1.5">
                {m.fromRubricLabel}
              </Label>
              <Select id="from-rubric" name="rubric">
                {rubrics.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="secondary" disabled={busy}>
              {m.fromRubricAction}
            </Button>
          </Form>
        </section>
      )}
    </div>
  );
}
