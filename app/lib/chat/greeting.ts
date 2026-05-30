import { interpolate, placeholdersIn, type TemplateValues } from "~/lib/template/interpolate";

/**
 * Prepare a chat greeting for display by substituting the sandbox values into
 * its {{placeholder}}s (e.g. scaffolding-feedback's "...helpen met {{subject}}").
 *
 * Greetings are cosmetic, so every placeholder is allowed to be empty: a missing
 * value renders as "" rather than throwing. This guarantees a user never sees a
 * literal "{{subject}}" in the first message.
 */
export function interpolateGreeting(text: string, values: TemplateValues): string {
  const placeholders = placeholdersIn(text);
  if (placeholders.length === 0) return text;
  return interpolate(text, values, { allowEmpty: placeholders });
}
