import type { Tool } from "../types";
import { ARCS_REACTOR_PROMPT } from "~/lib/prompts/arcs-reactor.prompt";
import { attribution } from "~/lib/prompts/attribution";

export const arcsReactor: Tool = {
  id: "arcs-reactor",
  slug: "arcs-reactor",
  nameNl: "ARCS Reactor — motivationeel ontwerp",
  taglineNl:
    "Diagnosticeer een motivatiebarrière en krijg concrete 'Learning PowerUps' volgens het ARCS-V-model.",
  icon: "zap",
  userType: "instructor",
  mode: "one-shot",
  theory: {
    name: "ARCS-V motivatiemodel",
    summaryNl:
      "Versterk motivatie via Attention, Relevance, Confidence, Satisfaction en Volition met kleine, gerichte interventies.",
    keyCitations: ["Keller (1987, 2008)"],
  },
  attribution: attribution({
    chapterTitle: "The ARCS Reactor: Powering Situated Intentional Motivational Design",
    authors: "Travis N Thurston",
    sourcePages: "pp. 187–189",
    evaluatedWith: "ChatGPT, Claude en Gemini",
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
      label: "Discipline",
      kind: "text",
      required: true,
      placeholder: "bijv. Webdevelopment",
      group: "Context",
    },
    {
      name: "cursusniveau",
      label: "Cursusniveau",
      kind: "select",
      required: true,
      options: [
        { value: "propedeuse", label: "Propedeuse (jaar 1)" },
        { value: "hoofdfase", label: "Hoofdfase (jaar 2–3)" },
        { value: "afstudeerfase", label: "Afstudeerfase (jaar 4)" },
      ],
      defaultValue: "propedeuse",
      group: "Context",
    },
    {
      name: "modaliteit",
      label: "Modaliteit",
      kind: "select",
      options: [
        { value: "contactonderwijs", label: "Contactonderwijs" },
        { value: "online", label: "Online" },
        { value: "hybride", label: "Hybride" },
        { value: "flipped", label: "Flipped classroom" },
      ],
      defaultValue: "contactonderwijs",
      group: "Context",
    },
    {
      name: "groepsgrootte",
      label: "Groepsgrootte",
      kind: "number",
      min: 1,
      max: 1000,
      defaultValue: 30,
      group: "Context",
    },
    {
      name: "studentkenmerken",
      label: "Sterktes en uitdagingen van studenten",
      kind: "textarea",
      rows: 2,
      placeholder: "bijv. technisch sterk, maar haken af bij theorie",
      group: "Context",
    },
    {
      name: "barriere",
      label: "De specifieke motivatiebarrière",
      kind: "textarea",
      required: true,
      rows: 3,
      help: "Beschrijf concreet waar de motivatie hapert.",
      placeholder:
        "bijv. studenten zien het nut van geautomatiseerd testen niet en slaan oefeningen over",
      group: "Context",
    },
  ],
  stages: [
    {
      id: "powerups",
      name: "Motivationele PowerUps",
      systemPromptId: ARCS_REACTOR_PROMPT.id,
      output: {
        kind: "structured-sections",
        hint: "ARCS-V-diagnose, 2–3 PowerUps, uitwerking, drie remixes en een wetenschappelijk inzicht.",
      },
    },
  ],
};
