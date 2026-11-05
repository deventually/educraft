import { z } from "zod";

/**
 * Hand values from a utility to a tool's form (P24.5: "Laat uitleggen" fills the tool with the
 * computed numbers). The values live in this browser tab's sessionStorage, keyed by the tool's
 * slug, and are taken once: nothing goes to the server until the teacher sends the form.
 */
const key = (slug: string) => `limeonit:handoff:${slug}`;
const ValuesSchema = z.record(z.string(), z.string());

function sessionStore(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

/** Store values for the tool with this slug. False when the browser refuses storage. */
export function writeHandoff(
  slug: string,
  values: Record<string, string>,
  storage: Storage | undefined = sessionStore(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key(slug), JSON.stringify(values));
    return true;
  } catch {
    return false;
  }
}

/** Take (read and remove) the values waiting for this tool, if any. */
export function takeHandoff(
  slug: string,
  storage: Storage | undefined = sessionStore(),
): Record<string, string> | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key(slug));
    if (raw === null) return null;
    storage.removeItem(key(slug));
    const parsed = ValuesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
