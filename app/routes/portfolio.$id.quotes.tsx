import { Link, useActionData } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { Route } from "./+types/portfolio.$id.quotes";
import { loadDossier } from "~/server/portfolio.server";
import { quotesAction } from "~/server/portfolioQuotes.server";
import { privacyPageFor } from "~/server/privacyGate.server";
import { FeedbackQuotes } from "~/components/portfolio/FeedbackQuotes";
import { SendRound } from "~/components/privacy/SendRound";
import { useFormToast } from "~/components/Toast";
import { useSendRound } from "~/lib/hooks/useSendRound";
import { useT } from "~/lib/i18n/useT";

export function meta() {
  return [{ title: "BDB/BKE — LimeOnIt" }];
}

/** The feedback items of the dossier, the criteria the quotes belong to, and what the gate knows. */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, dossier } = await loadDossier(request, params.id);
  const d = dossier.data;
  return {
    id: dossier.id,
    name: dossier.name,
    items: d.evidence
      .filter((e) => e.kind === "feedback")
      .map((e) => ({
        id: e.id,
        title: e.title,
        text: e.text,
        ...(e.feedback ? { feedback: e.feedback } : {}),
      })),
    outcomes: d.framework.outcomes.map((o) => ({
      id: o.id,
      code: o.code,
      title: o.title,
      criteria: o.criteria.map((c) => ({ id: c.id, text: c.text })),
    })),
    // The overview before sending shows what the gate will replace.
    privacy: await privacyPageFor(user),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  return quotesAction(request, params.id);
}

export default function PortfolioQuotes({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const tq = t.portfolioQuotes;
  const actionData = useActionData<typeof action>();
  const round = useSendRound(loaderData.privacy, actionData, "proposeQuotes");
  useFormToast(actionData, {
    pending: (fd) =>
      fd?.get("intent") === "proposeQuotes"
        ? { variant: "pending", message: tq.pending }
        : { variant: "pending", message: t.toast.saving },
    result: (r) => {
      if (!r) return null;
      // The gate's question takes focus itself; a toast would say it twice.
      if (!r.ok) return "privacyReview" in r ? null : { variant: "error", message: r.error };
      return { variant: "success", message: r.intent === "proposeQuotes" ? tq.proposed : tq.saved };
    },
  });
  const { id, name, items, outcomes } = loaderData;
  const proposal = actionData?.ok && actionData.intent === "proposeQuotes" ? actionData : undefined;

  return (
    <div className="w-full min-w-0">
      <Link
        to={`/portfolio/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {tq.back}
      </Link>
      <h1 className="mt-2 font-display text-2xl font-medium tracking-tight text-slate-900">
        {tq.title}
      </h1>
      <p className="mt-1 text-sm text-slate-600">{name}</p>
      <p className="mt-3 max-w-prose text-slate-700">{tq.intro}</p>
      <SendRound round={round} />
      {items.length === 0 ? (
        <p className="mt-6 max-w-prose text-slate-700">
          {tq.empty}{" "}
          <Link
            to={`/portfolio/${id}/evidence`}
            className="font-medium text-violet-700 underline underline-offset-2"
          >
            {tq.batchLink}
          </Link>
        </p>
      ) : (
        <div className="mt-6 grid gap-4">
          {items.map((item) => (
            // Keyed on what is stored: after Bewaar the item starts from the saved choice.
            <FeedbackQuotes
              key={`${item.id}:${JSON.stringify(item.feedback ?? null)}`}
              item={item}
              outcomes={outcomes}
              round={round}
              {...(proposal?.evidenceId === item.id ? { proposal } : {})}
            />
          ))}
        </div>
      )}
    </div>
  );
}
