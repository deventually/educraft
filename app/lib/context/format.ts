import type { ContextProfile, PackFieldValue } from "./types";
import { getDomainPack, type PackField } from "./packs";
import { loc } from "~/lib/i18n/localized";
import type { OutputLanguage } from "~/lib/registry/types";

interface Labels {
  intro: string;
  programme: string;
  course: string;
  year: string;
  eqf: string;
  professionalContext: string;
  tools: string;
  framework: string;
}

/**
 * The country-neutral level-adaptation directive, appended right after the EQF
 * line whenever a level is set. This — not any national label — is how level
 * adaptation reaches EVERY context-injecting tool through {{contextProfile}}, in
 * any EQF country, without the engine ever branching on level.
 *
 * It is deliberately reader-aware: almost every context-injecting tool is
 * instructor-facing, and a teacher is a professional adult regardless of the
 * students' level. So the level scales the *substance* — task complexity,
 * examples, and the depth expected of the students — for every tool; the *language
 * register* only adapts for text the learner reads directly (a chat tutor, or
 * feedback relayed to the student). "Never mention the level" keeps it implicit.
 */
const LEVEL_DIRECTIVE: Record<OutputLanguage, (n: number) => string> = {
  nl: (n) =>
    `- Stem de complexiteit, voorbeelden en verwachtingen af op dit niveau (EQF ${n}); pas het taalregister alleen aan bij tekst die de lerende zelf leest. Noem het niveau zelf niet.`,
  en: (n) =>
    `- Match complexity, examples and expectations to this level (EQF ${n}); adapt the language register only for text the learner reads directly. Do not mention the level itself.`,
};

/**
 * The learner-facing, **register-first** variant (Phase 6.8). The ~4 learner
 * tutors (scaffolding-feedback, socratic-partner, peer-tutoring, mentorai) speak
 * to the student directly, so the language register leads: pitch vocabulary,
 * sentence length and abstraction to the learner, start at the level and
 * recalibrate to what they show — never name the level. Selected via the
 * `audience: "learner"` argument; every instructor tool keeps {@link LEVEL_DIRECTIVE}.
 */
const LEVEL_DIRECTIVE_DIRECT: Record<OutputLanguage, (n: number) => string> = {
  nl: (n) =>
    `- Stem je woordkeuze, zinslengte en abstractieniveau af op deze lerende (EQF ${n}); begin op dit niveau en herijk op wat de lerende laat zien. Noem het niveau zelf niet.`,
  en: (n) =>
    `- Pitch your vocabulary, sentence length and level of abstraction to this learner (EQF ${n}); start there and recalibrate to what the learner shows. Do not mention the level itself.`,
};

/** Who reads the tool's output — governs which level directive is injected. */
export type Audience = "instructor" | "learner";

const LABELS: Record<OutputLanguage, Labels> = {
  nl: {
    intro: "Context van de opleiding (hbo, hoger beroepsonderwijs):",
    programme: "Opleiding",
    course: "Vak",
    year: "Studiejaar",
    eqf: "EQF-niveau",
    professionalContext: "Beroepspraktijk / werkveld",
    tools: "Technologie / methoden / instrumenten",
    framework: "Relevant kader",
  },
  en: {
    intro: "Programme context (Dutch higher professional education, hbo):",
    programme: "Programme",
    course: "Course",
    year: "Study year",
    eqf: "EQF level",
    professionalContext: "Professional field",
    tools: "Technology / methods / instruments",
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
  audience: Audience = "instructor",
): string {
  if (!profile) return "";
  const t = LABELS[lang];
  const lines: string[] = [t.intro];

  // Domain is intentionally NOT printed: it drives the framework pack below
  // (whose header already names the domain) and is implied by the programme.
  // Competencies and notes are likewise omitted — both are per-task and are
  // already collected by each generator tool's own inputs, so injecting them
  // here only duplicates and dilutes the task instruction.
  if (profile.programme) lines.push(`- ${t.programme}: ${profile.programme}`);
  if (profile.courseName) lines.push(`- ${t.course}: ${profile.courseName}`);
  if (profile.studyYear) lines.push(`- ${t.year}: ${profile.studyYear}`);
  if (profile.eqf) {
    lines.push(`- ${t.eqf}: EQF ${profile.eqf}`);
    const directive = audience === "learner" ? LEVEL_DIRECTIVE_DIRECT : LEVEL_DIRECTIVE;
    lines.push(directive[lang](profile.eqf));
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

  return lines.join("\n");
}
