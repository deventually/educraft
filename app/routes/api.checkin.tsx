import type { Route } from "./+types/api.checkin";
import { z } from "zod";
import { requireUser } from "~/server/auth.server";
import { dismissCheckin, saveCheckin } from "~/server/repositories/pilot.server";
import { CHECKIN_ANSWER_MAX } from "~/lib/pilot";

const answer = z.string().max(CHECKIN_ANSWER_MAX).optional();

const CheckinSchema = z.discriminatedUnion("intent", [
  z
    .object({ intent: z.literal("answer"), helped: answer, annoyed: answer, missing: answer })
    .refine((a) => [a.helped, a.annoyed, a.missing].some((s) => s?.trim()), {
      message: "empty",
    }),
  z.object({ intent: z.literal("dismiss") }),
]);

/**
 * Resource route (no UI): the signed-in teacher answers or dismisses the pilot
 * check-in. Validated at the boundary; always stored under the caller's own id.
 */
export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const parsed = CheckinSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });

  if (parsed.data.intent === "dismiss") await dismissCheckin(user.id);
  else await saveCheckin(user.id, parsed.data);
  return Response.json({ ok: true });
}
