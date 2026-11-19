/**
 * The referral guide (brief P39, 39.4): which counter of the institution helps with which kind
 * of question. Admin data, no AI: a model never names a counter, the teacher reads this list.
 * One counter per kind; a kind without a counter is simply absent. Pure and client-safe.
 */
import { z } from "zod";
import type { LocalizedText } from "~/lib/i18n/localized";

interface ReferralKind {
  id: string;
  label: LocalizedText;
  /** An example counter, shown as a placeholder in the admin's form. */
  example: LocalizedText;
}

export const REFERRAL_KINDS = [
  {
    id: "study-delay",
    label: { nl: "Studievertraging en regels", en: "Study delay and rules" },
    example: { nl: "bijv. Studiedecaan", en: "e.g. Student counsellor" },
  },
  {
    id: "mental-health",
    label: { nl: "Psychische klachten", en: "Mental health" },
    example: { nl: "bijv. Studentpsycholoog", en: "e.g. Student psychologist" },
  },
  {
    id: "disability",
    label: { nl: "Functiebeperking", en: "Disability" },
    example: { nl: "bijv. Studentendecaan", en: "e.g. Disability adviser" },
  },
  {
    id: "unwanted-behaviour",
    label: { nl: "Ongewenst gedrag", en: "Unwanted behaviour" },
    example: { nl: "bijv. Vertrouwenspersoon", en: "e.g. Confidential adviser" },
  },
  {
    id: "money",
    label: { nl: "Geld", en: "Money" },
    example: { nl: "bijv. Studentenloket", en: "e.g. Student desk" },
  },
] as const satisfies readonly ReferralKind[];

type ReferralKindId = (typeof REFERRAL_KINDS)[number]["id"];

const KIND_IDS = REFERRAL_KINDS.map((k) => k.id) as [ReferralKindId, ...ReferralKindId[]];

export const REFERRAL_CAPS = { counter: 120, description: 400, link: 500 } as const;

/** Only a web page over https or an e-mail address: never javascript:, data: or plain http. */
const safeLink = (v: string) => v === "" || /^(https:\/\/[^\s]+|mailto:[^\s@]+@[^\s@]+)$/i.test(v);

const ReferralEntrySchema = z.object({
  kind: z.enum(KIND_IDS),
  counter: z.string().trim().min(1).max(REFERRAL_CAPS.counter),
  description: z.string().trim().max(REFERRAL_CAPS.description),
  link: z.string().trim().max(REFERRAL_CAPS.link).refine(safeLink),
});

export type ReferralEntry = z.infer<typeof ReferralEntrySchema>;
export type ReferralGuide = ReferralEntry[];

/** Kind order, at most one entry per kind (the first wins). */
function normalise(entries: ReferralEntry[]): ReferralGuide {
  return KIND_IDS.flatMap((id) => entries.find((e) => e.kind === id) ?? []);
}

/** The stored guide, read defensively: anything invalid is dropped, it never throws. */
export function parseReferralGuide(value: unknown): ReferralGuide {
  if (!Array.isArray(value)) return [];
  return normalise(
    value.flatMap((v) => {
      const r = ReferralEntrySchema.safeParse(v);
      return r.success ? [r.data] : [];
    }),
  );
}

export type ReferralFormResult =
  | { ok: true; guide: ReferralGuide }
  | { ok: false; kind: ReferralKindId };

/**
 * The admin's form: per kind `counter-<kind>`, `description-<kind>` and `link-<kind>`. A kind
 * with all three empty is left out; a description or link without a counter is refused.
 */
export function referralGuideFromForm(fd: FormData): ReferralFormResult {
  const guide: ReferralGuide = [];
  for (const kind of KIND_IDS) {
    const field = (name: string) => String(fd.get(`${name}-${kind}`) ?? "").trim();
    const entry = {
      kind,
      counter: field("counter"),
      description: field("description"),
      link: field("link"),
    };
    if (!entry.counter && !entry.description && !entry.link) continue;
    const r = ReferralEntrySchema.safeParse(entry);
    if (!r.success) return { ok: false, kind };
    guide.push(r.data);
  }
  return { ok: true, guide };
}
