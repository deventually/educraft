import type { ContextProfile, PackFieldValue } from "./types";
import { getDomainPack, type PackField } from "./packs";
import { loc } from "~/lib/i18n/localized";
import type { OutputLanguage } from "~/lib/registry/types";

interface Labels {
  intro: string;
  programme: string;
  domain: string;
  course: string;
  year: string;
  eqf: string;
  competencies: string;
  professionalContext: string;
  tools: string;
  notes: string;
  framework: string;
}

const LABELS: Record<OutputLanguage, Labels> = {
  nl: {
    intro: "Context van de opleiding (hbo, hoger beroepsonderwijs):",
    programme: "Opleiding",
    domain: "Domein/sector",
    course: "Vak",
    year: "Studiejaar",
    eqf: "EQF-niveau",
    competencies: "Beoogde competenties / leeruitkomsten",
    professionalContext: "Beroepspraktijk / werkveld",
    tools: "Technologie / methoden / instrumenten",
    notes: "Aanvullende context",
    framework: "Relevant kader",
  },
  en: {
    intro: "Programme context (Dutch higher professional education, hbo):",
    programme: "Programme",
    domain: "Domain/sector",
    course: "Course",
    year: "Study year",
    eqf: "EQF level",
    competencies: "Target competencies / learning outcomes",
    professionalContext: "Professional field",
    tools: "Technology / methods / instruments",
    notes: "Additional context",
    framework: "Relevant framework",
  },
};

/** Render a single pack field's value into a human string, or "" if empty. */
function renderPackValue(field: PackField, value: PackFieldValue, lang: OutputLanguage): string {
  if (field.type === "level") {
    return typeof value === "number" ? String(value) : "";
  }
  const resolve = (v: string) => {
    const opt = field.options?.find((o) => o.value === v);
    return opt ? loc(opt.label, lang) : v;
  };
  if (Array.isArray(value)) {
    const parts = value.map(resolve).filter(Boolean);
    return parts.join(", ");
  }
  return typeof value === "string" && value ? resolve(value) : "";
}

/**
 * Render a context profile into a compact block for a prompt's
 * {{contextProfile}} placeholder, in the requested output language. Returns ""
 * for a null/empty profile so the placeholder collapses cleanly.
 */
export function formatProfile(
  profile: ContextProfile | null | undefined,
  lang: OutputLanguage,
): string {
  if (!profile) return "";
  const t = LABELS[lang];
  const lines: string[] = [t.intro];

  if (profile.programme) lines.push(`- ${t.programme}: ${profile.programme}`);
  if (profile.domain) lines.push(`- ${t.domain}: ${profile.domain}`);
  if (profile.courseName) lines.push(`- ${t.course}: ${profile.courseName}`);
  if (profile.studyYear) lines.push(`- ${t.year}: ${profile.studyYear}`);
  if (profile.eqf) lines.push(`- ${t.eqf}: EQF ${profile.eqf}`);
  if (profile.competencies?.trim()) {
    lines.push(`- ${t.competencies}: ${profile.competencies.trim()}`);
  }
  if (profile.professionalContext?.trim()) {
    lines.push(`- ${t.professionalContext}: ${profile.professionalContext.trim()}`);
  }
  if (profile.tools?.trim()) lines.push(`- ${t.tools}: ${profile.tools.trim()}`);

  // Domain pack — render only the fields with a value, resolved to the output language.
  const pack = getDomainPack(profile.domain);
  const packValues = profile.packValues;
  if (pack && packValues) {
    const rendered: string[] = [];
    for (const field of pack.fields) {
      const raw = packValues[field.key];
      if (raw == null) continue;
      const text = renderPackValue(field, raw, lang);
      if (text) rendered.push(`- ${loc(field.label, lang)}: ${text}`);
    }
    if (rendered.length) {
      lines.push(`${t.framework} (${loc(pack.source, lang)}):`);
      lines.push(...rendered);
    }
  }

  // User-defined custom fields.
  for (const cf of profile.customFields ?? []) {
    const label = cf.label?.trim();
    const value = cf.value?.trim();
    if (label && value) lines.push(`- ${label}: ${value}`);
  }

  if (profile.notes?.trim()) lines.push(`- ${t.notes}: ${profile.notes.trim()}`);
  return lines.join("\n");
}
