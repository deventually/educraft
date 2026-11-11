/**
 * The tabs of a dossier and of one learning outcome, like a course's (`courses/tabs.ts`): each
 * holds one task, so the teacher sees a few blocks at a time. The tab lives in the URL
 * (`?tab=`), so every tab can be linked to and a form posts back to the tab it was on.
 */
export const DOSSIER_TABS = ["overview", "finish"] as const;
export type DossierTab = (typeof DOSSIER_TABS)[number];

export const OUTCOME_TABS = ["overview", "evidence", "chapter", "review"] as const;
export type OutcomeTab = (typeof OUTCOME_TABS)[number];

const pick = <T extends string>(tabs: readonly T[], value: string | null): T =>
  tabs.find((t) => t === value) ?? (tabs[0] as T);

/** The tab a `?tab=` value names; anything else is the overview. */
export const dossierTab = (value: string | null): DossierTab => pick(DOSSIER_TABS, value);
export const outcomeTab = (value: string | null): OutcomeTab => pick(OUTCOME_TABS, value);

const href = (base: string, tab: string, anchor?: string) =>
  `${base}${tab === "overview" ? "" : `?tab=${tab}`}${anchor ? `#${anchor}` : ""}`;

/** The link to a tab of a dossier, optionally to an anchor on it. */
export function dossierHref(dossierId: string, tab: DossierTab, anchor?: string): string {
  return href(`/portfolio/${encodeURIComponent(dossierId)}`, tab, anchor);
}

/** The link to a tab of one learning outcome, optionally to an anchor on it. */
export function outcomeHref(
  dossierId: string,
  outcomeId: string,
  tab: OutcomeTab,
  anchor?: string,
): string {
  return href(
    `/portfolio/${encodeURIComponent(dossierId)}/outcome/${encodeURIComponent(outcomeId)}`,
    tab,
    anchor,
  );
}
