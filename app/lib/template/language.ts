/**
 * The output language, repeated where the model reads it last. Pure and free of prompts, so
 * the mode strategy (`registry/modes.ts`) can use it without pulling the prompt files along.
 */
import type { ChatMessage, OutputLanguage } from "~/lib/registry/types";

/**
 * A firm, final instruction that fixes the response language. Not every prompt
 * references {{outputLanguage}} (chat prompts in particular don't), and a
 * conversation begun in one language otherwise keeps its momentum. Appending
 * this — in the target language, "regardless of earlier messages" — makes the
 * selected output language take effect on the very next turn, for every tool.
 */
export const LANGUAGE_DIRECTIVE: Record<OutputLanguage, string> = {
  nl: "Belangrijk: antwoord altijd volledig in het Nederlands, ongeacht de taal van eerdere berichten in dit gesprek.",
  en: "Important: always respond entirely in English, regardless of the language of earlier messages in this conversation.",
};

/**
 * Reinforce the output language at the point of highest recency: the last user
 * turn. The system prompt already carries {@link LANGUAGE_DIRECTIVE}, but in a
 * long chat the model reads many prior-language turns *after* the system prompt,
 * and that momentum can outweigh a single up-front instruction. Echoing the
 * directive on the final user message — the last thing the model reads before
 * replying — makes a mid-conversation language switch take effect immediately.
 *
 * Returns a copy; the original history (used for the saved transcript) is left
 * untouched so the reminder never leaks into stored conversations.
 */
export function reinforceLanguage(
  messages: ChatMessage[],
  outputLanguage: OutputLanguage,
  /** A chat tool's own per-turn reminder (`ChatConfig.turnReminder`), added after the directive. */
  turnReminder?: string,
): ChatMessage[] {
  if (messages.length === 0) return messages;
  const lastIndex = messages.length - 1;
  const last = messages[lastIndex];
  if (last?.role !== "user") return messages;
  return messages.map((msg, i) =>
    i === lastIndex
      ? {
          ...msg,
          content: `${msg.content}\n\n[${LANGUAGE_DIRECTIVE[outputLanguage]}${turnReminder ? ` ${turnReminder}` : ""}]`,
        }
      : msg,
  );
}
