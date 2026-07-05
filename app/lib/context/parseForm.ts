/**
 * Parse + validate a context-profile form submission (from the wizard OR the
 * plain form — both post the same field names). Security boundary: pack values
 * are filtered against the domain registry (no arbitrary values), and custom
 * fields are trimmed, de-duplicated of empties, and capped in count + length.
 */
import {
  HBO_DOMAINS,
  type ContextProfile,
  type CustomField,
  type HboDomain,
  type PackFieldValue,
} from "./types";
import { getDomainPack } from "./packs";
import { isEqfLevel } from "./eqf";

export const MAX_CUSTOM_FIELDS = 30;
export const MAX_CUSTOM_LABEL = 120;
export const MAX_CUSTOM_VALUE = 600;

/** Input name prefix for domain-pack fields, e.g. `pack.architectuurlagen`. */
export const PACK_PREFIX = "pack.";

function str(v: FormDataEntryValue | null): string | undefined {
  const s = String(v ?? "").trim();
  return s || undefined;
}

function asDomain(v: FormDataEntryValue | null): HboDomain | undefined {
  const s = str(v);
  return s && (HBO_DOMAINS as readonly string[]).includes(s) ? (s as HboDomain) : undefined;
}

/** Collect + validate the selected domain's pack answers from the form. */
function parsePackValues(
  fd: FormData,
  domain: HboDomain | undefined,
): Record<string, PackFieldValue> | undefined {
  const pack = getDomainPack(domain);
  if (!pack) return undefined;
  const out: Record<string, PackFieldValue> = {};

  for (const field of pack.fields) {
    const name = PACK_PREFIX + field.key;
    if (field.type === "level") {
      const n = Number(str(fd.get(name)));
      if (Number.isInteger(n) && n >= 1 && n <= (field.levelMax ?? 1)) out[field.key] = n;
      continue;
    }
    const allowed = new Set(field.options?.map((o) => o.value));
    const picked = fd
      .getAll(name)
      .map((v) => String(v))
      .filter((v) => allowed.has(v));
    if (field.type === "multiselect") {
      if (picked.length) out[field.key] = picked;
    } else if (picked[0]) {
      out[field.key] = picked[0]; // single-select
    }
  }

  return Object.keys(out).length ? out : undefined;
}

/** Zip parallel customLabel[]/customValue[] inputs into trimmed, capped pairs. */
function parseCustomFields(fd: FormData): CustomField[] | undefined {
  const labels = fd.getAll("customLabel").map((v) => String(v));
  const values = fd.getAll("customValue").map((v) => String(v));
  const out: CustomField[] = [];
  for (let i = 0; i < labels.length && out.length < MAX_CUSTOM_FIELDS; i++) {
    const label = (labels[i] ?? "").trim().slice(0, MAX_CUSTOM_LABEL);
    const value = (values[i] ?? "").trim().slice(0, MAX_CUSTOM_VALUE);
    if (label && value) out.push({ label, value });
  }
  return out.length ? out : undefined;
}

export interface ParsedContextForm {
  input?: Omit<ContextProfile, "id">;
  isDefault: boolean;
  /** Set when validation fails (currently: missing name). */
  error?: "name-required";
}

export function parseContextForm(fd: FormData): ParsedContextForm {
  const name = String(fd.get("name") ?? "").trim();
  const isDefault = fd.get("isDefault") === "on";
  if (!name) return { isDefault, error: "name-required" };

  const domain = asDomain(fd.get("domain"));
  const yearRaw = String(fd.get("studyYear") ?? "");
  const eqfRaw = String(fd.get("eqf") ?? "");
  const year = Number(yearRaw);
  const eqf = Number(eqfRaw);

  const input: Omit<ContextProfile, "id"> = {
    name,
    programme: str(fd.get("programme")),
    domain,
    courseName: str(fd.get("courseName")),
    studyYear: yearRaw && year >= 1 && year <= 4 ? (year as 1 | 2 | 3 | 4) : undefined,
    eqf: eqfRaw && isEqfLevel(eqf) ? eqf : undefined,
    professionalContext: str(fd.get("professionalContext")),
    tools: str(fd.get("tools")),
    packValues: parsePackValues(fd, domain),
    customFields: parseCustomFields(fd),
  };

  return { input, isDefault };
}
