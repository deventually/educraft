/**
 * Pack tags on a learning outcome (brief P21, 21.6). The allowed keys and options are data:
 * the fields of the pack of the course's context profile (`DOMAIN_PACKS`). The engine stays
 * sector-neutral; a course without a pack has no tags. Form fields are `tag:<key>`.
 */
import type { DomainPack } from "~/lib/context/packs";
import type { PackFieldValue } from "~/lib/context/types";

export const TAG_PREFIX = "tag:";

export type PackTagsResult =
  | { ok: true; tags: Record<string, PackFieldValue> | undefined }
  | { ok: false };

/** Reads `tag:<key>` fields; an unknown key, an unknown option or a bad level refuses all. */
export function parsePackTags(fd: FormData, pack: DomainPack): PackTagsResult {
  const fields = new Map(pack.fields.map((f) => [f.key, f]));
  const tags: Record<string, PackFieldValue> = {};
  for (const name of new Set(fd.keys())) {
    if (!name.startsWith(TAG_PREFIX)) continue;
    const field = fields.get(name.slice(TAG_PREFIX.length));
    if (!field) return { ok: false };
    const values = fd
      .getAll(name)
      .map((v) => String(v).trim())
      .filter(Boolean);
    if (values.length === 0) continue;
    if (field.type === "level") {
      const n = Number(values[0]);
      if (values.length > 1 || !Number.isInteger(n) || n < 1 || n > (field.levelMax ?? 1))
        return { ok: false };
      tags[field.key] = n;
      continue;
    }
    const allowed = new Set(field.options?.map((o) => o.value));
    if (values.some((v) => !allowed.has(v))) return { ok: false };
    if (field.type === "multiselect") tags[field.key] = [...new Set(values)];
    else if (values.length > 1) return { ok: false };
    else tags[field.key] = values[0] ?? "";
  }
  return { ok: true, tags: Object.keys(tags).length ? tags : undefined };
}

/** "Label: value" lines for display, in pack order; unknown keys are skipped. */
export function packTagLines(
  tags: Record<string, PackFieldValue> | undefined,
  pack: DomainPack | undefined,
  label: (text: DomainPack["fields"][number]["label"]) => string,
): string[] {
  if (!tags || !pack) return [];
  return pack.fields.flatMap((f) => {
    const v = tags[f.key];
    if (v === undefined) return [];
    const shown = (Array.isArray(v) ? v : [v]).map((value) => {
      const option = f.options?.find((o) => o.value === value);
      return option ? label(option.label) : String(value);
    });
    return [`${label(f.label)}: ${shown.join(", ")}`];
  });
}
