import { useState } from "react";
import { Link } from "react-router";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import type { Route } from "./+types/portfolio.$id.rehearsal";
import { loadDossier } from "~/server/portfolio.server";
import { updateDossier } from "~/server/repositories/portfolio.server";
import { getDefaultProfile } from "~/server/repositories/profiles.server";
import { getSelectableModels } from "~/server/availability.server";
import { getLocale } from "~/lib/i18n/locale.server";
import { getMessages } from "~/lib/i18n";
import { getToolBySlugOrThrow } from "~/lib/registry";
import {
  REHEARSAL_LENGTHS,
  type RehearsalLength,
  addRehearsalFeedback,
  parseRehearsalFeedback,
  rehearsalKeys,
} from "~/lib/portfolio/rehearsal";
import { outcomeLabel } from "~/lib/portfolio/format";
import { ChatView } from "~/components/ChatView";
import { RehearsalFeedback } from "~/components/portfolio/RehearsalFeedback";
import { Button, Card } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";

const TOOL_SLUG = "portfolio-rehearsal";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: `${data?.title ?? "Proefassessment"} — LimeOnIt` }];
}

/**
 * The rehearsal of a dossier (brief P29, 29.3). Only for its owner with the workplace
 * on (`loadDossier`). The page sends the framework (to choose outcomes and read the
 * feedback) and the references, never the chapters: the server builds the prompt.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, dossier } = await loadDossier(request, params.id);
  const d = dossier.data;
  const tool = getToolBySlugOrThrow(TOOL_SLUG);
  const profile = await getDefaultProfile(user.id);
  return {
    id: dossier.id,
    name: dossier.name,
    title: getMessages(getLocale(request)).portfolioRehearsal.title,
    tool,
    framework: d.framework,
    references: d.references,
    catalogModels: await getSelectableModels(user),
    contextProfile: profile ? { id: profile.id } : null,
  };
}

const KeepSchema = z.object({
  raw: z.string().min(1).max(40_000),
  userTurns: z.array(z.string().max(20_000)).max(100),
  outcomeIds: z.array(z.string().max(100)).max(100),
  model: z.string().min(1).max(200),
});

function json(value: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(value ?? ""));
  } catch {
    return null;
  }
}

/**
 * "Bewaar in je dossier": the server checks the feedback again against the teacher's
 * own turns (quotes, keys, sources) before it is kept. Only the feedback, never the
 * conversation (Bastiaan's choice, 2026-11-05).
 */
export async function action({ request, params }: Route.ActionArgs) {
  const { user, dossier } = await loadDossier(request, params.id);
  const locale = getLocale(request);
  const m = getMessages(locale);
  const fd = await request.formData();
  if (fd.get("intent") !== "keepRehearsal")
    return { ok: false as const, error: m.portfolio.errorInvalid };
  const parsed = KeepSchema.safeParse({
    raw: fd.get("raw"),
    userTurns: json(fd.get("userTurns")),
    outcomeIds: json(fd.get("outcomeIds")),
    model: fd.get("model"),
  });
  if (!parsed.success) return { ok: false as const, error: m.portfolio.errorInvalid };
  const { raw, userTurns, outcomeIds, model } = parsed.data;
  const d = dossier.data;
  const result = parseRehearsalFeedback(raw, rehearsalKeys(d.framework, outcomeIds), d, userTurns);
  if (!result.ok || result.feedback.criteria.length === 0)
    return { ok: false as const, error: m.portfolioRehearsal.errorUnreadable };
  const next = addRehearsalFeedback(d, result.feedback, {
    at: Date.now(),
    model,
    locale,
    id: crypto.randomUUID(),
  });
  const saved = await updateDossier(user.id, dossier.id, { data: next }).catch(() => null);
  if (!saved) return { ok: false as const, error: m.portfolio.errorInvalid };
  return { ok: true as const, intent: "keepRehearsal" };
}

/** The model's answer looks like the closing JSON (bare or in a code block). */
const looksLikeFeedback = (content: string) => /^\s*(```(json)?\s*)?\{/.test(content);

export default function PortfolioRehearsal({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const tr = t.portfolioRehearsal;
  const { id, name, tool, framework, references, catalogModels, contextProfile } = loaderData;
  const [length, setLength] = useState<RehearsalLength>("short");
  const [chosen, setChosen] = useState<string[]>(framework.outcomes.map((o) => o.id));
  const [started, setStarted] = useState(false);
  const hasCriteria = framework.outcomes.some((o) => o.criteria.length > 0);
  // All chosen = all outcomes: the server then takes every outcome, as the brief says.
  const outcomeIds = chosen.length === framework.outcomes.length ? [] : chosen;
  const keys = rehearsalKeys(framework, outcomeIds);

  return (
    <div className="flex w-full min-w-0 flex-col md:h-[calc(100vh-8rem)]">
      <Link
        to={`/portfolio/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {tr.back}
      </Link>
      <h1 className="mt-2 font-display text-2xl font-medium tracking-tight text-slate-900">
        {tr.title}
      </h1>
      <p className="mt-1 text-sm text-slate-600">{name}</p>

      {!started ? (
        <Card className="mt-4 max-w-2xl p-5">
          <p className="text-sm text-slate-700">{tr.intro}</p>
          {hasCriteria ? (
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (chosen.length > 0) setStarted(true);
              }}
            >
              <fieldset>
                <legend className="text-sm font-medium text-slate-900">{tr.length}</legend>
                {REHEARSAL_LENGTHS.map((value) => (
                  <label
                    key={value}
                    className="mt-2 flex items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="radio"
                      name="length"
                      value={value}
                      checked={length === value}
                      onChange={() => setLength(value)}
                      className="size-4 text-violet-600 focus:ring-violet-500"
                    />
                    {tr.lengths[value]}
                  </label>
                ))}
              </fieldset>
              <fieldset aria-describedby="rehearsal-outcomes-hint">
                <legend className="text-sm font-medium text-slate-900">{tr.outcomes}</legend>
                <p id="rehearsal-outcomes-hint" className="text-xs text-slate-600">
                  {tr.outcomesHint}
                </p>
                {framework.outcomes.map((o) => (
                  <label key={o.id} className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={chosen.includes(o.id)}
                      onChange={(e) =>
                        setChosen((prev) =>
                          e.target.checked ? [...prev, o.id] : prev.filter((x) => x !== o.id),
                        )
                      }
                      className="size-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    />
                    {outcomeLabel(o)}
                  </label>
                ))}
                {chosen.length === 0 && (
                  <p className="mt-2 text-sm text-red-700" role="alert">
                    {tr.pickOne}
                  </p>
                )}
              </fieldset>
              <Button type="submit" disabled={chosen.length === 0}>
                {tr.start}
              </Button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-slate-700">{tr.noCriteria}</p>
          )}
        </Card>
      ) : (
        <div className="mt-4 flex flex-col md:min-h-0 md:flex-1">
          <ChatView
            tool={tool}
            contextProfile={contextProfile}
            catalogModels={catalogModels}
            values={{ length, outcomeIds }}
            settingsSummary={[
              { name: "length", label: tr.length, value: tr.lengths[length] },
              {
                name: "outcomeIds",
                label: tr.outcomes,
                value: outcomeIds.length
                  ? framework.outcomes
                      .filter((o) => outcomeIds.includes(o.id))
                      .map(outcomeLabel)
                      .join(", ")
                  : tr.allOutcomes,
              },
            ]}
            streamExtras={{ dossierId: id }}
            renderAssistant={(content, { streaming, userTurns, model }) => {
              if (!looksLikeFeedback(content)) return undefined;
              if (streaming) return <p className="italic text-slate-500">{tr.making}</p>;
              const parsed = parseRehearsalFeedback(content, keys, { references }, userTurns);
              if (!parsed.ok) return <p className="text-slate-700">{tr.errorUnreadable}</p>;
              return (
                <RehearsalFeedback
                  dossierId={id}
                  framework={framework}
                  feedback={parsed.feedback}
                  raw={content}
                  userTurns={userTurns}
                  outcomeIds={outcomeIds}
                  model={model}
                />
              );
            }}
          />
        </div>
      )}
    </div>
  );
}
