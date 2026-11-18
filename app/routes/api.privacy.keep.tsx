import type { Route } from "./+types/api.privacy.keep";
import { z } from "zod";
import { requireUser } from "~/server/auth.server";
import { addKeepWord, removeKeepWord } from "~/server/repositories/keepWords.server";

const KeepSchema = z.object({
  intent: z.enum(["add", "remove"]),
  word: z.string().max(200),
});

/**
 * Resource route (no UI): the signed-in teacher's never-list from the live preview
 * (anonymiseerpoort PR 3). Validated at the boundary; always the caller's own list. A word that
 * looks like personal data (a digit, an `@`) is refused.
 */
export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const parsed = KeepSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
  if (parsed.data.intent === "remove") {
    await removeKeepWord(user.id, parsed.data.word);
    return Response.json({ ok: true });
  }
  const ok = await addKeepWord(user.id, parsed.data.word);
  return Response.json({ ok }, { status: ok ? 200 : 400 });
}
