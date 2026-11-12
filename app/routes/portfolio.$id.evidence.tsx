import { useEffect, useRef } from "react";
import { Link, useActionData } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { Route } from "./+types/portfolio.$id.evidence";
import { loadDossier, saveIntent } from "~/server/portfolio.server";
import { LIMITS } from "~/lib/portfolio/schema";
import { BatchEvidence } from "~/components/portfolio/BatchEvidence";
import { useFormToast } from "~/components/Toast";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

export function meta() {
  return [{ title: "BDB/BKE — LimeOnIt" }];
}

/** Evidence in one go: the framework the list needs and the room left in the dossier. */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { dossier } = await loadDossier(request, params.id);
  const d = dossier.data;
  return {
    id: dossier.id,
    name: dossier.name,
    confirmed: d.framework.confirmedAt !== undefined,
    room: Math.max(0, LIMITS.evidence - d.evidence.length),
    evidenceCount: d.evidence.length,
    outcomes: d.framework.outcomes.map((o) => ({
      id: o.id,
      code: o.code,
      title: o.title,
      criteria: o.criteria.map((c) => ({ id: c.id, text: c.text })),
      requiredEvidence: o.requiredEvidence,
    })),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  return saveIntent(request, params.id);
}

export default function PortfolioEvidence({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const tb = t.portfolioBatch;
  const actionData = useActionData<typeof action>();
  useFormToast(actionData, {
    pending: (fd) =>
      fd?.get("intent") === "proposeEvidence"
        ? { variant: "pending", message: tb.pending }
        : { variant: "pending", message: t.toast.saving },
    result: (r) => {
      if (!r) return null;
      if (!r.ok) return { variant: "error", message: r.error };
      if (r.intent === "proposeEvidence") return { variant: "success", message: tb.proposed };
      const n = r.added ?? 0;
      return { variant: "success", message: n === 1 ? tb.addedOne : fmt(tb.added, { n }) };
    },
  });
  const { id, name, confirmed, room, outcomes, evidenceCount } = loaderData;
  // Once the ticked items are added, the list and its button are gone: focus the heading.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (actionData?.ok && actionData.intent === "addEvidenceBatch") heading.current?.focus();
  }, [actionData]);
  const sorted =
    actionData?.ok && actionData.intent === "proposeEvidence" ? actionData.sorted : undefined;

  return (
    <div className="w-full min-w-0">
      <Link
        to={`/portfolio/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {tb.back}
      </Link>
      <h1
        ref={heading}
        tabIndex={-1}
        className="mt-2 font-display text-2xl font-medium tracking-tight text-slate-900 focus:outline-none"
      >
        {tb.title}
      </h1>
      <p className="mt-1 text-sm text-slate-600">{name}</p>
      <p className="mt-3 max-w-prose text-slate-700">{tb.intro}</p>
      {/* Keyed on the evidence count: once the ticked items are added, the page starts fresh. */}
      <BatchEvidence
        key={evidenceCount}
        dossierId={id}
        outcomes={outcomes}
        room={room}
        confirmed={confirmed}
        sorted={sorted}
      />
    </div>
  );
}
