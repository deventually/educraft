import type { ChatMessage, OutputLanguage } from "~/lib/registry/types";

const LABELS: Record<OutputLanguage, { user: string; assistant: string }> = {
  nl: { user: "Jij", assistant: "Assistent" },
  en: { user: "You", assistant: "Assistant" },
};

/**
 * Collapse a multi-turn chat into a single Markdown document so the whole
 * session is stored (and shown on the Projects page) as one artifact rather
 * than one row per turn. Each turn keeps its content verbatim — fenced code
 * blocks survive intact and can be syntax-highlighted on render.
 */
export function buildChatTranscript(messages: ChatMessage[], language: OutputLanguage): string {
  const labels = LABELS[language] ?? LABELS.nl;
  return messages
    .filter((m) => m.content.trim().length > 0)
    .map((m) => `**${labels[m.role]}:**\n\n${m.content.trim()}`)
    .join("\n\n");
}
