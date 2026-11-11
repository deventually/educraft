import type { Route } from "./+types/api.ai-cancel";
import { z } from "zod";
import { requireUser } from "~/server/auth.server";
import { cancelAiCall, isAiCallId } from "~/server/aiCalls.server";

const CancelSchema = z.object({ callId: z.string().refine(isAiCallId) });

/**
 * Resource route (no UI): the teacher left a page while an AI action ran and chose "Stop".
 * Stops that action's model calls, only ever the caller's own (aiCalls.server).
 */
export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const parsed = CancelSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });

  cancelAiCall(user.id, parsed.data.callId);
  return Response.json({ ok: true });
}
