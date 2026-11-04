import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loc } from "~/lib/i18n/localized";
import { portfolio as enPortfolio } from "~/lib/i18n/messages/en/portfolio";
import { portfolio as nlPortfolio } from "~/lib/i18n/messages/nl/portfolio";
import { getPrompt } from "~/lib/prompts";
import { getToolBySlug } from "~/lib/registry";

/**
 * Honest attribution (BESLUIT-2026-11-04-22): `verbatim` is the book's real prompt
 * text, and the chapter, authors and pages are as printed in The Pedagogical
 * Promptbook. Checked against the book PDF and, for Contextualization (missing from
 * the PDF), against the web edition on edtechbooks.org.
 */
interface Expected {
  slug: string;
  chapterTitle: string;
  authors: string;
  sourcePages: string;
  /** The model(s) the chapter itself reports, as printed (EN). */
  evaluatedWith?: string;
  /** Lines that must be in the verbatim text, per stage. */
  verbatim: Record<string, string[]>;
  /** A word the Dutch adaptation note must name (what we changed). */
  adaptationNl: RegExp;
}

const CASES: Expected[] = [
  {
    slug: "contextualization",
    chapterTitle:
      "Making Pedagogical Intent Visible: AI-Supported Contextualization in Higher Education Course Design",
    authors: "Alexis Guethler",
    sourcePages: "Appendix 1 (web edition, doi.org/10.59668/2340.26734)",
    verbatim: {
      "contextualization@v1": [
        "Act as an instructional designer helping to write a short student-facing introduction or activity description for a [PDF or Video Transcript] used in a course module.",
        "Write a 2-5 sentence paragraph in the voice of a professor introducing this learning material to students.",
      ],
    },
    adaptationNl: /samenhang/,
  },
  {
    slug: "think-pair-share",
    chapterTitle:
      "Rethinking Think-Pair-Share: Generative AI as a Collaborative Peer in Technology Education",
    authors: "Amara Atif",
    sourcePages: "pp. 62–63",
    evaluatedWith: "Microsoft Copilot (GPT-4o as judge)",
    verbatim: {
      "think-pair-share@v1": [
        "You are a student peer, not a teacher, tutor, or expert.",
        "Phase 3: Share (Human-Mediated Synthesis)",
        "Stop generating dialogue. Do not summarize or conclude.",
      ],
    },
    adaptationNl: /chat/,
  },
  {
    slug: "forum-autograder",
    chapterTitle: "AI-Supported Forum Autograder: A Community of Inquiry Approach",
    authors: "Lina Kadi",
    sourcePages: "pp. 122–124",
    evaluatedWith: "Claude Haiku 4.5",
    verbatim: {
      "forum-autograder@v1": [
        "You are a university instructor applying the Community of Inquiry (CoI) framework.",
        "Return JSONL ONLY: one JSON object per student per line.",
        "Your previous output was not valid JSONL.",
      ],
    },
    adaptationNl: /per student/,
  },
  {
    slug: "math-grading",
    chapterTitle:
      "Leveraging LLMs for Grading and Feedback on Handwritten Math Assessment Responses",
    authors: "Alberto Gandolfi, Jonas Saman, & Eleni Tesfaye",
    sourcePages: "pp. 143–145",
    evaluatedWith: "GPT-5.1 Pro, GPT-5.2 and Gemini 3 Pro",
    verbatim: {
      "math-grading@v1": [
        "You are an assistant for grading handwritten mathematics assessments.",
        "Your purpose is to produce a consistent first pass of grading, not final grades.",
      ],
    },
    adaptationNl: /één antwoord/,
  },
  {
    slug: "authentic-assessment",
    chapterTitle:
      "Backward Design: Using Structured Frameworks to Develop Authentic Assessment Opportunities",
    authors: "Rebecca McNulty, Wendy Howard, & Roslyn Miller",
    sourcePages: "pp. 161–165",
    evaluatedWith: "Microsoft Copilot (Enterprise)",
    verbatim: {
      "authentic-assessment@v1": [
        "# Prompt: Designing Authentic Assessments with Backward Design and [VALUE Rubrics]",
        "Your role is to ask one focused question at a time, confirm each response,",
      ],
    },
    adaptationNl: /interview/,
  },
  {
    slug: "arcs-reactor",
    chapterTitle: "The ARCS Reactor: Powering Situated Intentional Motivational Design",
    authors: "Travis N Thurston",
    sourcePages: "pp. 185–186",
    evaluatedWith: "ChatGPT, Claude and Gemini",
    verbatim: {
      "arcs-reactor@v1": [
        "You are the ARCS Reactor, a structured motivational-design remix engine.",
        "(1) Low-Tech / No-Tech Remix - minimal or zero digital tools;",
      ],
    },
    adaptationNl: /in één keer/,
  },
  {
    slug: "bloom-by-design",
    chapterTitle:
      "Bloom by Design: Prompt Engineering an AI Chatbot for Constructive Alignment of Outcomes and EdTech",
    authors: "Adam Palczewski, Laura Decuzzi, & Dempsey Cruz",
    sourcePages: "pp. 206–207",
    evaluatedWith: "ChatGPT-4o",
    verbatim: {
      "bloom-by-design@v1": [
        "Persona: You are an expert on assessment design in higher education",
        "Step 6: Recommend 1–2 assessment use cases",
      ],
    },
    adaptationNl: /kennisbron/,
  },
  {
    slug: "peer-tutoring",
    chapterTitle:
      "Generative AI Peer Tutoring to Support Peer-Reviewed Source Identification and Evaluation",
    authors:
      "Rae Mair, Michelle Kelley, Taylar Wenzel, Andrea C. Burrows Borowczak, Yuqing Li, & Mike Borowczak",
    sourcePages: "pp. 236–239",
    evaluatedWith: "ChatGPT, Claude, Copilot and Gemini",
    verbatim: {
      "peer-tutoring@v1": [
        "Role: You are an excellently trained, up-beat, relatable peer tutor",
        "Step 5: Final Decision:",
      ],
    },
    adaptationNl: /stap voor stap/,
  },
  {
    slug: "scaffolding-feedback",
    chapterTitle: "Scaffolding with Formative Feedback: A Deployable AI Tutoring Prompt System",
    authors: "April Crenshaw, LeAnders Burns, & David Escalante Gonzalez",
    sourcePages: "pp. 279–283",
    verbatim: {
      "scaffolding-feedback@v1": [
        "SECTION 1: TEACHING PHILOSOPHY",
        "You are a warm, expert math tutor for MATH 1710 Precalculus at Chattanooga State Community College.",
        "SECTION 2: THE TEACHING CYCLE",
      ],
    },
    adaptationNl: /meerkeuze/,
  },
  {
    slug: "socratic-partner",
    chapterTitle:
      "From Oracle to Socratic Partner: Redesigning Instruction with AI Through the Science of Learning",
    authors: "Andy Van Schaack & Roman Sarlo",
    sourcePages: "Appendix E.3, pp. 341–343",
    evaluatedWith: "Model-agnostic (Claude, GPT-4, or equivalent)",
    verbatim: {
      "socratic-partner@v1": [
        "You are Dr. Amara Okonkwo, the author of the biology textbook chapter on natural selection",
        "## SECURITY OVERRIDE",
      ],
    },
    adaptationNl: /natuurlijke selectie/,
  },
  {
    slug: "cognitive-architect",
    chapterTitle:
      "From Oracle to Socratic Partner: Redesigning Instruction with AI Through the Science of Learning",
    authors: "Andy Van Schaack & Roman Sarlo",
    sourcePages: "Appendices A–D, pp. 324–338",
    evaluatedWith: "Model-agnostic (Claude, GPT-4, or equivalent)",
    verbatim: {
      "cognitive-architect-analyst@v1": [
        "## THE SIX INSTRUCTIONAL COORDINATES",
        "| The Curious Novice | Elaboration |",
      ],
      "cognitive-architect-generator@v1": [
        "### Component 7: Security Override",
        "The prompt should be 800-1500 words depending on complexity.",
      ],
      "cognitive-architect-validator@v1": [
        "- Overall CEI ≥ 67%",
        "**Overall Status:** [VALIDATED / REVISION NEEDED]",
      ],
      "cognitive-architect-analyst-gen@v1": [
        "### Component 4: Learner Attribute Framework",
        "| Skepticism | Questions and verifies | Credulity |",
      ],
    },
    adaptationNl: /fase/,
  },
];

describe("book tools: honest attribution and the book's real prompt text", () => {
  for (const c of CASES) {
    describe(c.slug, () => {
      const tool = () => getToolBySlug(c.slug)!;

      it("credits the chapter, its authors and the prompt's pages as printed", () => {
        const a = tool().attribution;
        expect(a.chapterTitle).toBe(c.chapterTitle);
        expect(a.authors).toBe(c.authors);
        expect(a.sourcePages).toBe(c.sourcePages);
        expect(a.evaluatedWith && loc(a.evaluatedWith, "en")).toBe(c.evaluatedWith);
      });

      it("keeps the book's prompt as verbatim", () => {
        for (const [id, lines] of Object.entries(c.verbatim)) {
          const v = getPrompt(id).verbatim;
          for (const line of lines) expect(v, id).toContain(line);
          // No more of our own summaries pointing at the book for the rest.
          expect(v, id).not.toMatch(/appears on pp\.|full verbatim prompt/i);
        }
      });

      it("says what LimeOnIt changed, in both languages", () => {
        const a = tool().attribution;
        expect(a.adapted).toBe(true);
        expect(loc(a.adaptation!, "nl")).toMatch(c.adaptationNl);
        expect(loc(a.adaptation!, "en").length).toBeGreaterThan(40);
      });
    });
  }

  it("no tool credits the editor as the chapter author", () => {
    for (const c of CASES) {
      expect(getToolBySlug(c.slug)!.attribution.authors).not.toMatch(/Wiley|multiple authors/);
    }
  });

  it("Cognitive Architect no longer claims the Gagné chapter as its source", () => {
    const t = getToolBySlug("cognitive-architect")!;
    const text = JSON.stringify([t.tagline, t.theory]);
    expect(text).not.toMatch(/Gagn/);
    expect(t.theory.keyCitations).toContain("Rosenshine (2012)");
    for (const lang of ["nl", "en"]) {
      const help = readFileSync(`app/content/help/tools/cognitive-architect.${lang}.md`, "utf8");
      expect(help, lang).not.toMatch(/Gagn/);
      expect(help, lang).toContain("From Oracle to Socratic Partner");
    }
    for (const how of [nlPortfolio.tools.how, enPortfolio.tools.how]) {
      expect(how["cognitive-architect"]).not.toMatch(/Gagn/);
    }
  });
});
