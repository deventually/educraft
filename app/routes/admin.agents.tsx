import type { Route } from "./+types/admin.agents";
import { requireRole } from "~/server/auth.server";
import { AGENTS, getAgent } from "~/lib/agents/registry";
import { isAgentStand } from "~/lib/agents/types";
import { FEATURES } from "~/lib/features";
import { isInstanceStand } from "~/lib/features/rule";
import {
  getAgentStands,
  getFeatureStands,
  setAgentStand,
  setFeatureStand,
} from "~/server/repositories/settings.server";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
import { fmt } from "~/lib/i18n/format";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { OnOffSelect, StandSelect } from "~/components/features/selects";

const MAIN_DEFAULT = FEATURES.find((f) => f.id === "roleAgents")?.defaultStand ?? "on";

/**
 * The role agents' switches. The main switch is the `roleAgents` feature (the same
 * setting as on /admin/tools, so teams and exceptions apply); below it each hat is On or
 * Off for the whole instance. A hat that is off neither runs nor shows; its stored
 * advice stays and returns when it is switched on again.
 */
export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  const [features, stands] = await Promise.all([getFeatureStands(), getAgentStands()]);
  return {
    main: features.roleAgents ?? MAIN_DEFAULT,
    agents: AGENTS.map((a) => ({
      id: a.id,
      role: a.role,
      watches: a.watches,
      stand: stands[a.id] ?? "on",
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, "admin");
  const fd = await request.formData();
  const intent = fd.get("intent");
  const stand = fd.get("stand");

  if (intent === "main" && isInstanceStand(stand)) {
    await setFeatureStand("roleAgents", stand);
    return { saved: true as const };
  }

  const id = String(fd.get("id") ?? "");
  if (intent === "agent" && getAgent(id) && isAgentStand(stand)) {
    await setAgentStand(id, stand);
    return { saved: true as const };
  }

  return { error: "invalid" as const };
}

export default function AdminAgents({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const a = t.agents.admin;
  const { main, agents } = loaderData;
  const invalid = () => t.error.invalidRequest;
  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
          {a.heading}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{a.intro}</p>
        <AutoSaveForm intent="main" errorMessage={invalid} className="mt-4">
          <label className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-800">
            <span>{a.mainLabel}</span>
            <StandSelect label={a.mainLabel} defaultValue={main} />
          </label>
        </AutoSaveForm>
        <p className="mt-2 max-w-2xl text-xs text-slate-500">{a.mainHint}</p>
        {main === "off" && (
          <p className="mt-3 max-w-2xl rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {a.mainOff}
          </p>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
          {a.hatsHeading}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{a.hatsIntro}</p>
        <div className="mt-4 max-w-2xl overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{a.caption}</caption>
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {a.colHat}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {a.colWatches}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {a.colStand}
                </th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => {
                const name = loc(agent.role, locale);
                return (
                  <tr key={agent.id} className="border-b border-slate-50 last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-medium text-slate-800">
                      {name}
                    </th>
                    <td className="px-4 py-2.5 text-slate-600">
                      {agent.watches.map((w) => a.watches[w]).join(", ")}
                    </td>
                    <td className="px-4 py-2.5">
                      <AutoSaveForm intent="agent" hidden={{ id: agent.id }} errorMessage={invalid}>
                        <OnOffSelect
                          label={fmt(a.standLabel, { name })}
                          defaultValue={agent.stand}
                        />
                      </AutoSaveForm>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
