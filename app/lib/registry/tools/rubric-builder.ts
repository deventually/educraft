import type { Tool } from "../types";
import { RUBRIC_BUILDER_PROMPT } from "~/lib/prompts/rubric-builder@v1.prompt";
import { originalAttribution } from "~/lib/prompts/attribution";

const OUTCOME = { nl: "Leeruitkomst en opdracht", en: "Learning outcome and assignment" };
const RUBRIC = { nl: "Beoordelingsmodel", en: "Rubric" };

/**
 * Beoordelingsmodel (rubric) maken — brief P24, 24.2. An original LimeOnIt tool: from the
 * teacher's learning outcome and assignment a draft analytic rubric (criteria, observable
 * levels, points, pass mark, knock-out rules) and a self-check; a pasted rubric is checked
 * first. The table uses the rubric editor's own Markdown layout (rubricToMarkdown).
 */
export const rubricBuilder: Tool = {
  id: "rubric-builder",
  slug: "rubric-builder",
  name: { nl: "Beoordelingsmodel maken", en: "Create an assessment rubric" },
  subtitle: {
    nl: "Analytische rubric met cesuur en zelfcheck",
    en: "Analytic rubric with pass mark and self-check",
  },
  tagline: {
    nl: "Maak bij je leeruitkomst een concept-rubric met waarneembare niveaus, punten en een cesuur, of laat je eigen rubric controleren op overlap en vaagheid.",
    en: "Build a draft rubric for your learning outcome, with observable levels, points and a pass mark, or have your own rubric checked for overlap and vagueness.",
  },
  icon: "table",
  userType: "instructor",
  mode: "one-shot",
  theory: {
    name: {
      nl: "Analytische rubrics en de herziene taxonomie van Bloom",
      en: "Analytic rubrics and the revised Bloom's taxonomy",
    },
    summary: {
      nl: "Een rubric bestaat uit criteria en per criterium beschrijvingen van niveaus. Goede criteria passen bij de leeruitkomst, zijn waarneembaar, overlappen niet en dekken samen de leeruitkomst; goede niveaus beschrijven wat je in het werk ziet (Brookhart, 2013). Het werkwoord van de leeruitkomst bepaalt het denkniveau dat de cesuur vraagt (Anderson & Krathwohl, 2001).",
      en: "A rubric consists of criteria and, per criterion, descriptions of levels. Good criteria fit the learning outcome, are observable, do not overlap and together cover the outcome; good levels describe what you see in the work (Brookhart, 2013). The outcome's verb sets the cognitive level the pass mark asks for (Anderson & Krathwohl, 2001).",
    },
    keyCitations: ["Brookhart (2013)", "Anderson & Krathwohl (2001)"],
  },
  attribution: originalAttribution({
    source: {
      nl: "Origineel LimeOnIt-instrument, met ontwerpregels naar Brookhart (2013) en Anderson & Krathwohl (2001).",
      en: "Original LimeOnIt instrument, with design rules after Brookhart (2013) and Anderson & Krathwohl (2001).",
    },
  }),
  usesContextProfile: true,
  defaultOutputLanguage: "nl",
  next: ["stage-assessment"],
  courseActions: ["assessment"],
  defaultModel: "claude-sonnet-5-5",
  defaultMaxTokens: 8192,
  defaultTemperature: 0.3,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "learningOutcome",
      prefillFromCourse: { source: "learningOutcomes" },
      label: { nl: "Leeruitkomst", en: "Learning outcome" },
      kind: "textarea",
      required: true,
      rows: 3,
      placeholder: {
        nl: "bijv. De student stelt op basis van een eigen analyse een onderbouwd verbeteradvies op voor een bedrijfsproces.",
        en: "e.g. The student writes a well-founded improvement proposal for a business process, based on their own analysis.",
      },
      help: {
        nl: 'Gebruik een waarneembaar werkwoord, zoals analyseert, ontwerpt of beargumenteert. Bij "begrijpt" of "kent" stelt de tool eerst een scherpere formulering voor.',
        en: 'Use an observable verb, such as analyses, designs or argues. With "understands" or "knows" the tool first proposes a sharper wording.',
      },
      group: OUTCOME,
    },
    {
      name: "assignment",
      label: { nl: "Opdracht", en: "Assignment" },
      kind: "textarea",
      required: true,
      rows: 3,
      placeholder: {
        nl: "Wat maakt of doet de student? bijv. Adviesrapport van 3000 woorden voor een mkb-opdrachtgever.",
        en: "What does the student make or do? e.g. An advisory report of 3,000 words for a small business client.",
      },
      group: OUTCOME,
    },
    {
      name: "levelCount",
      label: { nl: "Aantal niveaus", en: "Number of levels" },
      kind: "select",
      defaultValue: "3",
      options: [
        { value: "2", label: { nl: "2 niveaus", en: "2 levels" } },
        { value: "3", label: { nl: "3 niveaus", en: "3 levels" } },
        { value: "4", label: { nl: "4 niveaus", en: "4 levels" } },
        { value: "5", label: { nl: "5 niveaus", en: "5 levels" } },
      ],
      group: RUBRIC,
    },
    {
      name: "scale",
      label: {
        nl: "Punten, cesuur en slaagregels (optioneel)",
        en: "Points, pass mark and pass rules (optional)",
      },
      kind: "textarea",
      rows: 3,
      placeholder: {
        nl: "bijv. Maximaal 100 punten, cesuur 55%. Bronvermelding is knock-out.",
        en: "e.g. 100 points maximum, pass mark 55%. Referencing is knock-out.",
      },
      help: {
        nl: "Leeg laten mag: dan doet de tool een voorstel, en dat staat er ook bij.",
        en: "You may leave this empty: the tool then makes a proposal, and says so.",
      },
      group: RUBRIC,
    },
    {
      name: "existingRubric",
      label: {
        nl: "Bestaande rubric controleren (optioneel)",
        en: "Check an existing rubric (optional)",
      },
      kind: "textarea",
      rows: 6,
      placeholder: {
        nl: "Plak hier je huidige rubric. De tool zoekt overlap, vage of niet-waarneembare niveaus en punten die niet kloppen, en maakt een verbeterde versie.",
        en: "Paste your current rubric here. The tool looks for overlap, vague or unobservable levels and points that don't add up, and makes an improved version.",
      },
      group: RUBRIC,
    },
  ],
  stages: [
    {
      id: "rubric",
      name: { nl: "Beoordelingsmodel", en: "Rubric" },
      systemPromptId: RUBRIC_BUILDER_PROMPT.id,
      output: {
        kind: "structured-sections",
        exportAs: "rubric",
        hint: {
          nl: "Koppeling met de leeruitkomst, eventueel de controle van je rubric, de rubric als tabel, punten en cesuur, en een zelfcheck.",
          en: "Link to the learning outcome, the check of your rubric if given, the rubric as a table, points and pass mark, and a self-check.",
        },
      },
    },
  ],
};
