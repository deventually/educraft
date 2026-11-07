import type { Tool } from "../types";
import { DIFFERENTIATION_PROMPT } from "~/lib/prompts/differentiation@v1.prompt";
import { originalAttribution } from "~/lib/prompts/attribution";

/**
 * Opdracht differentiëren — brief P24, 24.7. An original LimeOnIt tool: the teacher's task
 * or explanation in three variants (extra support, the base, extra challenge) that all assess
 * the same learning goal, after Tomlinson (2017), with a short tip on using them in class.
 */
export const differentiation: Tool = {
  id: "differentiation",
  slug: "differentiation",
  name: { nl: "Opdracht differentiëren", en: "Differentiate a task" },
  subtitle: {
    nl: "Drie varianten met hetzelfde leerdoel, naar Tomlinson",
    en: "Three variants with the same learning goal, after Tomlinson",
  },
  tagline: {
    nl: "Maak van je opdracht of uitleg drie varianten: met extra steun, de basis en met extra uitdaging. Alle drie toetsen ze hetzelfde leerdoel, met een tip hoe je ze in de les inzet.",
    en: "Turn your task or explanation into three variants: with extra support, the base and with extra challenge. All three assess the same learning goal, with a tip on using them in class.",
  },
  icon: "route",
  userType: "instructor",
  mode: "one-shot",
  theory: {
    name: {
      nl: "Differentiëren (Tomlinson)",
      en: "Differentiated instruction (Tomlinson)",
    },
    summary: {
      nl: "Differentiëren is de inhoud, de werkwijze of het product aanpassen aan waar studenten staan, met hetzelfde leerdoel voor iedereen. Elke variant is een respectvolle taak, de docent plant vanuit wat de groep kan bereiken en geeft steun om daar te komen, en de groepen wisselen per opdracht (Tomlinson, 2017).",
      en: "Differentiation means adapting the content, the process or the product to where students are, with the same learning goal for everyone. Every variant is a respectful task, the teacher plans from what the group can reach and gives support to get there, and the groups change from task to task (Tomlinson, 2017).",
    },
    keyCitations: ["Tomlinson (2017)"],
  },
  attribution: originalAttribution({
    source: {
      nl: "Origineel LimeOnIt-instrument, met differentiëren naar Tomlinson (2017).",
      en: "Original LimeOnIt instrument, with differentiation after Tomlinson (2017).",
    },
  }),
  usesContextProfile: true,
  defaultOutputLanguage: "nl",
  next: ["clear-assignment", "engagement-check"],
  courseActions: ["activity"],
  defaultModel: "claude-sonnet-5-5",
  defaultMaxTokens: 12288,
  defaultTemperature: 0.3,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "learningGoal",
      prefillFromCourse: { source: "learningOutcomes" },
      label: { nl: "Leerdoel", en: "Learning goal" },
      kind: "textarea",
      required: true,
      rows: 2,
      placeholder: {
        nl: "bijv. De student stelt bij een casus een verpleegkundige diagnose op volgens de PES-structuur.",
        en: "e.g. The student writes a nursing diagnosis for a case using the PES structure.",
      },
      help: {
        nl: 'Gebruik een waarneembaar werkwoord, zoals berekent, legt uit of ontwerpt. Bij "begrijpt" of "kent" stelt de tool een scherpere formulering voor.',
        en: 'Use an observable verb, such as calculates, explains or designs. With "understands" or "knows" the tool proposes a sharper wording.',
      },
    },
    {
      name: "material",
      label: { nl: "Je opdracht of uitleg", en: "Your task or explanation" },
      kind: "textarea",
      required: true,
      rows: 8,
      placeholder: {
        nl: "Plak de opdracht of uitleg zoals je die nu aan studenten geeft.",
        en: "Paste the task or explanation as you give it to students now.",
      },
    },
    {
      name: "groupInfo",
      label: {
        nl: "Wat je weet over verschillen in de groep (optioneel)",
        en: "What you know about differences in the group (optional)",
      },
      kind: "textarea",
      rows: 3,
      placeholder: {
        nl: "bijv. Een deel van de groep loopt al stage; een paar studenten zijn zij-instromers zonder vooropleiding in de zorg.",
        en: "e.g. Part of the group already does a placement; a few students are career switchers without a healthcare background.",
      },
      help: {
        nl: "Beschrijf de groep, geen personen: geen namen of andere gegevens van studenten.",
        en: "Describe the group, not people: no names or other student details.",
      },
    },
  ],
  stages: [
    {
      id: "variants",
      name: { nl: "Drie varianten", en: "Three variants" },
      systemPromptId: DIFFERENTIATION_PROMPT.id,
      output: {
        kind: "structured-sections",
        hint: {
          nl: "Leerdoel en succescriterium, een variant met extra steun, de basisvariant, een variant met extra uitdaging, hoe je ze inzet en een check op de varianten.",
          en: "Learning goal and success criterion, a variant with extra support, the base variant, a variant with extra challenge, how to use them and a check of the variants.",
        },
      },
    },
  ],
};
