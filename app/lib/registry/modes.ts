/**
 * How a tool runs, as one strategy per kind: a conversation, chained stages, or a single
 * generation. Everything that differs between them lives here, so routes and components ask
 * the strategy instead of branching on `tool.mode` (AGENTS.md principle 4; enforced in
 * `tests/architecture.test.ts`). Pure and client-safe: no prompts, no server.
 */
import { loc } from "~/lib/i18n/localized";
import { reinforceLanguage } from "~/lib/template/language";
import type { ChatMessage, OutputLanguage, Tool } from "./types";

/** The workspace a tool opens in. */
export type ToolKind = "chat" | "multiStage" | "oneShot";

export interface ModeStrategy {
  readonly kind: ToolKind;
  /** The workspace takes the full page height, so a chat's composer can stay pinned. */
  readonly fillsHeight: boolean;
  /** Its work may reach a colleague through a shared course; a conversation never does. */
  readonly sharesWork: boolean;
  /** Its prompt comes back on the next turn (a chat), so the provider may cache it. */
  readonly cachesPrompt: boolean;
  /** The turns the model answers: a chat's own history, otherwise one trigger. */
  turns(history: ChatMessage[] | undefined, lang: OutputLanguage): ChatMessage[];
  /** The turns as sent: a chat repeats the language (and its reminder) on the last turn. */
  promptTurns(turns: ChatMessage[], lang: OutputLanguage): ChatMessage[];
  /** The row a run is kept in: a chat's session id, or null for a new row every run. */
  sessionId(raw: string | undefined): string | null;
}

const TRIGGER: Record<OutputLanguage, string> = {
  nl: "Voer de opdracht volledig uit.",
  en: "Carry out the task in full.",
};

const trigger = (lang: OutputLanguage): ChatMessage[] => [{ role: "user", content: TRIGGER[lang] }];

/** A session id within the bounds the stream accepts, trimmed; anything else is no session. */
function boundedSession(raw: string | undefined): string | null {
  const id = raw?.trim() ?? "";
  return id.length >= 8 && id.length <= 100 ? id : null;
}

function generation(kind: "multiStage" | "oneShot"): ModeStrategy {
  return {
    kind,
    fillsHeight: false,
    sharesWork: true,
    cachesPrompt: false,
    turns: (_history, lang) => trigger(lang),
    promptTurns: (turns) => turns,
    sessionId: () => null,
  };
}

const ONE_SHOT = generation("oneShot");
const MULTI_STAGE = generation("multiStage");

function conversation(tool: Pick<Tool, "chat">): ModeStrategy {
  return {
    kind: "chat",
    fillsHeight: true,
    sharesWork: false,
    cachesPrompt: true,
    turns: (history, lang) => history ?? trigger(lang),
    promptTurns: (turns, lang) =>
      reinforceLanguage(turns, lang, loc(tool.chat?.turnReminder, lang)),
    sessionId: boundedSession,
  };
}

const STRATEGIES: Record<Tool["mode"], (tool: Pick<Tool, "chat" | "stages">) => ModeStrategy> = {
  chat: conversation,
  "one-shot": (tool) => (tool.stages.length === 1 ? ONE_SHOT : MULTI_STAGE),
};

/** The strategy for a tool. */
export function modeOf(tool: Pick<Tool, "mode" | "chat" | "stages">): ModeStrategy {
  return STRATEGIES[tool.mode](tool);
}
