import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { DEFAULT_TIME_ZONE } from "~/lib/calendar/weeks";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";

/** Jev's switch as the admin page shows it: the stand, who set it last and when, the key. */
export interface JevSwitchState {
  on: boolean;
  keySet: boolean;
  /** The name of the admin who set it last; absent when never set or the account is gone. */
  byName?: string;
  /** When it was set last (ISO); absent when never set. */
  at?: string;
  timeZone?: string;
}

/**
 * TypeSafe Jev's one switch (BESLUIT-2026-11-17-1): what goes to whom, and switching on as the
 * institution's consent. Autosaves like the rest of the page; the action records who and when.
 */
export function JevSwitch({ state }: { state: JevSwitchState }) {
  const t = useT();
  const j = t.jev;
  const locale = useLocale();
  const when = state.at
    ? new Date(state.at).toLocaleString(locale === "en" ? "en-GB" : "nl-NL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: state.timeZone ?? DEFAULT_TIME_ZONE,
      })
    : null;
  const status = when
    ? fmt(state.on ? j.switchedOn : j.switchedOff, { name: state.byName ?? j.someone, when })
    : j.never;
  return (
    <section aria-labelledby="jev-heading">
      <h2
        id="jev-heading"
        className="font-display text-lg font-medium tracking-tight text-slate-900"
      >
        {j.heading}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">{j.intro}</p>
      <AutoSaveForm
        intent="jev"
        aria-labelledby="jev-heading"
        errorMessage={() => t.error.invalidRequest}
        className="mt-4 max-w-2xl"
      >
        <div className="flex items-start gap-2.5">
          <input
            type="checkbox"
            id="jev-on"
            name="on"
            defaultChecked={state.on}
            aria-describedby="jev-akkoord"
            className="mt-0.5 size-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
          />
          <div>
            <label htmlFor="jev-on" className="text-sm font-medium text-slate-800">
              {j.label}
            </label>
            <p id="jev-akkoord" className="mt-1 text-xs text-slate-500">
              {j.akkoord}
            </p>
          </div>
        </div>
      </AutoSaveForm>
      <p className="mt-3 text-sm text-slate-600">{status}</p>
      {!state.keySet && <p className="mt-2 max-w-2xl text-sm text-amber-800">{j.keyMissing}</p>}
    </section>
  );
}
