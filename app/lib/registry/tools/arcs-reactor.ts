import type { Tool } from "../types";
import { ARCS_REACTOR_PROMPT } from "~/lib/prompts/arcs-reactor.prompt";
import { attribution } from "~/lib/prompts/attribution";

const CONTEXT = { nl: "Context", en: "Context" };

export const arcsReactor: Tool = {
  id: "arcs-reactor",
  slug: "arcs-reactor",
  name: { nl: "ARCS Reactor — motivationeel ontwerp", en: "ARCS Reactor — motivational design" },
  tagline: {
    nl: "Diagnosticeer een motivatiebarrière en krijg concrete 'Learning PowerUps' volgens het ARCS-V-model.",
    en: "Diagnose a motivational barrier and get concrete 'Learning PowerUps' using the ARCS-V model.",
  },
  icon: "zap",
  userType: "instructor",
  mode: "one-shot",
  theory: {
    name: { nl: "ARCS-V motivatiemodel", en: "ARCS-V motivation model" },
    summary: {
      nl: "Versterk motivatie via Attention, Relevance, Confidence, Satisfaction en Volition met kleine, gerichte interventies.",
      en: "Strengthen motivation via Attention, Relevance, Confidence, Satisfaction and Volition with small, targeted interventions.",
    },
    keyCitations: ["Keller (1987, 2008)"],
  },
  attribution: attribution({
    chapterTitle: "The ARCS Reactor: Powering Situated Intentional Motivational Design",
    authors: "Travis N Thurston",
    sourcePages: "pp. 187–189",
    evaluatedWith: { nl: "ChatGPT, Claude en Gemini", en: "ChatGPT, Claude and Gemini" },
    adapted: true,
  }),
  usesContextProfile: true,
  defaultOutputLanguage: "nl",
  defaultModel: "claude-sonnet-4-6",
  defaultTemperature: 0.5,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "discipline",
      label: { nl: "Discipline", en: "Discipline" },
      kind: "text",
      required: true,
      placeholder: { nl: "bijv. Webdevelopment", en: "e.g. Web development" },
      group: CONTEXT,
    },
    {
      name: "cursusniveau",
      label: { nl: "Cursusniveau", en: "Course level" },
      kind: "select",
      required: true,
      options: [
        { value: "foundation year (year 1)", label: { nl: "Propedeuse (jaar 1)", en: "Foundation year (year 1)" } },
        { value: "main phase (years 2-3)", label: { nl: "Hoofdfase (jaar 2–3)", en: "Main phase (years 2–3)" } },
        { value: "graduation phase (year 4)", label: { nl: "Afstudeerfase (jaar 4)", en: "Graduation phase (year 4)" } },
      ],
      defaultValue: "foundation year (year 1)",
      group: CONTEXT,
    },
    {
      name: "modaliteit",
      label: { nl: "Modaliteit", en: "Modality" },
      kind: "select",
      options: [
        { value: "in-person", label: { nl: "Contactonderwijs", en: "In-person" } },
        { value: "online", label: { nl: "Online", en: "Online" } },
        { value: "hybrid", label: { nl: "Hybride", en: "Hybrid" } },
        { value: "flipped classroom", label: { nl: "Flipped classroom", en: "Flipped classroom" } },
      ],
      defaultValue: "in-person",
      group: CONTEXT,
    },
    {
      name: "groepsgrootte",
      label: { nl: "Groepsgrootte", en: "Class size" },
      kind: "number",
      min: 1,
      max: 1000,
      defaultValue: 30,
      group: CONTEXT,
    },
    {
      name: "studentkenmerken",
      label: { nl: "Sterktes en uitdagingen van studenten", en: "Student strengths and challenges" },
      kind: "textarea",
      rows: 2,
      placeholder: {
        nl: "bijv. technisch sterk, maar haken af bij theorie",
        en: "e.g. technically strong, but disengage with theory",
      },
      group: CONTEXT,
    },
    {
      name: "barriere",
      label: { nl: "De specifieke motivatiebarrière", en: "The specific motivational barrier" },
      kind: "textarea",
      required: true,
      rows: 3,
      help: {
        nl: "Beschrijf concreet waar de motivatie hapert.",
        en: "Describe concretely where motivation breaks down.",
      },
      placeholder: {
        nl: "bijv. studenten zien het nut van geautomatiseerd testen niet en slaan oefeningen over",
        en: "e.g. students don't see the point of automated testing and skip the exercises",
      },
      group: CONTEXT,
    },
  ],
  stages: [
    {
      id: "powerups",
      name: { nl: "Motivationele PowerUps", en: "Motivational PowerUps" },
      systemPromptId: ARCS_REACTOR_PROMPT.id,
      output: {
        kind: "structured-sections",
        hint: {
          nl: "ARCS-V-diagnose, 2–3 PowerUps, uitwerking, drie remixes en een wetenschappelijk inzicht.",
          en: "ARCS-V diagnosis, 2–3 PowerUps, an expansion, three remixes and a scholarly insight.",
        },
      },
    },
  ],
};
