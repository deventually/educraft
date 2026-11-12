import type { PromptDef } from "./types";
import en from "./files/conversation-prep@v2.en.md?raw";
import nl from "./files/conversation-prep@v2.nl.md?raw";
import { CONVERSATION_PREP_PROMPT } from "./conversation-prep@v1.prompt";

/**
 * SOURCE: Original LimeOnIt tool (brief P39, 39.2); see `conversation-prep@v1.prompt.ts`.
 *
 * What @v2 changes: neutral phases and choice that fit mbo as well as hbo and wo
 * (`first-year`, `later-years`, `direction-or-internship-choice` instead of `propaedeutic`,
 * `main-phase`, `minor-or-internship-choice`), named in the programme's own words.
 */
export const CONVERSATION_PREP_PROMPT_V2: PromptDef = {
  id: "conversation-prep@v2",
  verbatim: CONVERSATION_PREP_PROMPT.verbatim,
  runtime: { nl, en },
};
