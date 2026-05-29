import {
  type ContextProfile,
  HBOI_ARCHITECTURE_LAYER_LABELS,
  HBOI_ACTIVITY_LABELS,
} from "./types";
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
  hboiIntro: string;
  layers: string;
  activities: string;
  hboiLevel: string;
}

const LABELS: Record<OutputLanguage, Labels> = {
  nl: {
    intro: "Deze les wordt ontworpen binnen het hbo (hoger beroepsonderwijs).",
    programme: "Opleiding",
    domain: "Domein/sector",
    course: "Vak",
    year: "Studiejaar",
    eqf: "EQF-niveau",
    competencies: "Beoogde competenties / leeruitkomsten",
    professionalContext: "Beroepspraktijk / werkveld",
    tools: "Technologie / methoden / instrumenten",
    notes: "Aanvullende context",
    hboiIntro: "Relevant hbo-i-kader (ICT):",
    layers: "Architectuurlagen",
    activities: "Beroepsactiviteiten",
    hboiLevel: "Beheersingsniveau",
  },
  en: {
    intro:
      "This lesson is designed within Dutch higher professional education (hbo).",
    programme: "Programme",
    domain: "Domain/sector",
    course: "Course",
    year: "Study year",
    eqf: "EQF level",
    competencies: "Target competencies / learning outcomes",
    professionalContext: "Professional field",
    tools: "Technology / methods / instruments",
    notes: "Additional context",
    hboiIntro: "Relevant hbo-i framework (ICT):",
    layers: "Architecture layers",
    activities: "Professional activities",
    hboiLevel: "Proficiency level",
  },
};

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

  const hasIctPack =
    profile.domain === "ICT" &&
    (profile.architectureLayers?.length ||
      profile.activities?.length ||
      profile.hboiLevel);
  if (hasIctPack) {
    lines.push(t.hboiIntro);
    if (profile.hboiLevel) lines.push(`- ${t.hboiLevel}: ${profile.hboiLevel}`);
    if (profile.architectureLayers?.length) {
      const layers = profile.architectureLayers.map((l) => HBOI_ARCHITECTURE_LAYER_LABELS[l][lang]);
      lines.push(`- ${t.layers}: ${layers.join(", ")}`);
    }
    if (profile.activities?.length) {
      const acts = profile.activities.map((a) => HBOI_ACTIVITY_LABELS[a][lang]);
      lines.push(`- ${t.activities}: ${acts.join(", ")}`);
    }
  }

  if (profile.notes?.trim()) lines.push(`- ${t.notes}: ${profile.notes.trim()}`);
  return lines.join("\n");
}
