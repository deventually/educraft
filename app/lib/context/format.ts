import type { ContextProfile, PackFieldValue } from "./types";
import type { PackField } from "./packs";
import { resolveFramework } from "./frameworks";
import { getDomainsForTrack } from "./domains";
import { domainFieldLabel } from "./relevance";
import { resolveLevel } from "./derive";
import {
  SECTORS_INFO,
  VO_PHASES,
  isSector,
  learnerNounFor,
  teacherNounFor,
  type Sector,
} from "./sectors";
import { loc } from "~/lib/i18n/localized";
import type { OutputLanguage } from "~/lib/registry/types";

interface Labels {
  /** Fallback intro for a legacy profile with no sector (hbo-flavoured). */
  intro: string;
  programme: string;
  phase: string;
  course: string;
  year: string;
  eqf: string;
  professionalContext: string;
  tools: string;
  pedagogy: string;
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

/**
 * One neutral note appended when the derived level is the Instroomniveau
 * approximation (below EQF 1). It never names the national term — the word
 * "instapniveau"/"entry level" is a generic register cue, not "NLQF"/"Instroom".
 */
const ENTRY_LEVEL_NOTE: Record<OutputLanguage, string> = {
  nl: "- Dit is een instapniveau onder het laagste kwalificatieniveau: houd de stof extra concreet, toegankelijk en kleinstappig.",
  en: "- This is an entry level below the lowest qualification level: keep the material especially concrete, accessible and in small steps.",
};

/** Who reads the tool's output — governs which level directive is injected. */
export type Audience = "instructor" | "learner";

const LABELS: Record<OutputLanguage, Labels> = {
  nl: {
    intro: "Context van de opleiding (hbo, hoger beroepsonderwijs):",
    programme: "Opleiding",
    phase: "Fase",
    course: "Vak",
    year: "Studiejaar",
    eqf: "EQF-niveau",
    professionalContext: "Beroepspraktijk / werkveld",
    tools: "Technologie / methoden / instrumenten",
    pedagogy: "Onderwijsconcept / didactische aanpak",
    framework: "Relevant kader",
  },
  en: {
    intro: "Programme context (Dutch higher professional education, hbo):",
    programme: "Programme",
    phase: "Phase",
    course: "Course",
    year: "Study year",
    eqf: "EQF level",
    professionalContext: "Professional field",
    tools: "Technology / methods / instruments",
    pedagogy: "Educational concept / didactic approach",
    framework: "Relevant framework",
  },
};

/** The context intro, adapted to the sector when set (else the hbo fallback). */
function introFor(sector: Sector | undefined, lang: OutputLanguage): string {
  if (!sector) return LABELS[lang].intro;
  const label = loc(SECTORS_INFO[sector].label, lang);
  return lang === "nl" ? `Context van de opleiding (${label}):` : `Programme context (${label}):`;
}

/**
 * The learner-noun + teacher-noun directive (both audiences). Injected whenever a
 * sector is set so the right vocabulary reaches every tool without editing the
 * prompt files. It carries only nouns — no national term ever appears.
 */
function nounDirective(sector: Sector, override: string | undefined, lang: OutputLanguage): string {
  const learner = learnerNounFor(sector, override, lang);
  const teacher = teacherNounFor(sector, lang);
  return lang === "nl"
    ? `- Spreek over de lerenden als "${learner}" en over de begeleider als "${teacher}", passend bij dit onderwijstype.`
    : `- Refer to the learners as "${learner}" and to the teacher as "${teacher}", as fits this type of education.`;
}

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
  const sector = isSector(profile.sector ?? "") ? (profile.sector as Sector) : undefined;
  const lines: string[] = [introFor(sector, lang)];

  // Domain is intentionally NOT printed: it drives the framework pack below
  // (whose header already names the domain) and is implied by the programme.
  // Competencies and notes are likewise omitted — both are per-task and are
  // already collected by each generator tool's own inputs, so injecting them
  // here only duplicates and dilutes the task instruction.
  if (profile.programme) lines.push(`- ${t.programme}: ${profile.programme}`);
  if (profile.courseName) lines.push(`- ${t.course}: ${profile.courseName}`);
  // Domain: kept implicit where a verified framework exists (hbo — the pack
  // header + programme already convey it; June 2026 slimming). For vo there is no
  // pack and often no programme, so the chosen profiel IS the signal — inject it
  // with its label ("Profiel: Natuur & Techniek") so it isn't lost.
  if (sector === "vo" && profile.domain) {
    const opt = getDomainsForTrack(profile.country, profile.sector, profile.track).find(
      (d) => d.value === profile.domain,
    );
    const value = opt ? loc(opt.label, lang) : profile.domain;
    lines.push(`- ${loc(domainFieldLabel(profile.sector), lang)}: ${value}`);
  }
  if (profile.phase) {
    const opt = VO_PHASES.find((p) => p.value === profile.phase);
    lines.push(`- ${t.phase}: ${opt ? loc(opt.label, lang) : profile.phase}`);
  }
  if (profile.studyYear) lines.push(`- ${t.year}: ${profile.studyYear}`);
  // Level: derive the country-neutral EQF from the profile (national level, else
  // legacy/synthetic eqf) and inject only the number + the existing directive —
  // the national label never reaches the prompt.
  const lvl = resolveLevel(profile);
  if (lvl) {
    lines.push(`- ${t.eqf}: EQF ${lvl.eqf}`);
    const directive = audience === "learner" ? LEVEL_DIRECTIVE_DIRECT : LEVEL_DIRECTIVE;
    lines.push(directive[lang](lvl.eqf));
    if (lvl.entryLevel) lines.push(ENTRY_LEVEL_NOTE[lang]);
  }
  // Learner/teacher vocabulary, driven by sector (both audiences).
  if (sector) lines.push(nounDirective(sector, profile.learnerNounOverride, lang));
  if (profile.professionalContext?.trim()) {
    lines.push(`- ${t.professionalContext}: ${profile.professionalContext.trim()}`);
  }
  if (profile.tools?.trim()) lines.push(`- ${t.tools}: ${profile.tools.trim()}`);
  // Onderwijsconcept / didactic approach — injected verbatim like the field above.
  if (profile.pedagogy?.trim()) lines.push(`- ${t.pedagogy}: ${profile.pedagogy.trim()}`);

  // Verified framework pack — resolved via country → sector → domain, so it
  // renders only where a national framework exists (hbo today). Elsewhere the
  // block is simply absent — nothing is invented.
  const pack = resolveFramework(profile.country, profile.sector, profile.domain);
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
