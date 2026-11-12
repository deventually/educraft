/**
 * A short label that tells one saved result apart from another of the same tool, for
 * "Eerder gemaakt": the teacher's own words in the first filled text fields, else the
 * result's first heading. Generic over the registry: no per-tool code. Student work
 * (`redact`) never becomes a label.
 */
type LabelField = { name: string; kind: string; redact?: boolean };

const MAX = 60;
const FIELDS = 2;

export function workLabel(
  inputs: readonly LabelField[],
  values: unknown,
  markdown = "",
): string | undefined {
  const record = values && typeof values === "object" ? (values as Record<string, unknown>) : {};
  const parts = inputs
    .filter((f) => (f.kind === "text" || f.kind === "textarea") && !f.redact)
    .map((f) => record[f.name])
    .map((v) => (typeof v === "string" ? cut(firstLine(v)) : ""))
    .filter(Boolean)
    .slice(0, FIELDS);
  if (parts.length > 0) return parts.join(" · ");
  const heading = markdown.match(/^#{1,6}\s+(.+)$/m)?.[1];
  const plain = heading ? cut(heading.replace(/[*_`]/g, "").trim()) : "";
  return plain || undefined;
}

function firstLine(text: string): string {
  return text.trim().split("\n")[0]?.trim() ?? "";
}

function cut(text: string): string {
  return text.length > MAX ? `${text.slice(0, MAX - 1).trimEnd()}…` : text;
}
