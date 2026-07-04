import type { Route } from "./+types/api.feedback";
import { z } from "zod";
import { requireUser } from "~/server/auth.server";
import { getGeneration } from "~/server/repositories/generations.server";
import { upsertFeedback } from "~/server/repositories/feedback.server";

const FeedbackSchema = z.object({
  generationId: z.string().min(1).max(100),
  rating: z.union([z.literal(1), z.literal(-1)]),
  comment: z.string().max(2000).optional(),
});

/**
 * Resource route (no UI): record a tester's rating for one of *their own*
 * generations. Validates the body at the boundary, verifies ownership (a
 * user-scoped lookup that returns nothing for someone else's generation), and
 * upserts one row per (user, generation) so re-rating updates rather than
 * duplicates.
 */
export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const parsed = FeedbackSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });

  // Ownership gate: the lookup is scoped to the caller, so another user's
  // generation id simply isn't found.
  const generation = await getGeneration(user.id, parsed.data.generationId);
  if (!generation) return Response.json({ ok: false }, { status: 403 });

  await upsertFeedback({
    userId: user.id,
    generationId: parsed.data.generationId,
    rating: parsed.data.rating,
    comment: parsed.data.comment ?? null,
  });
  return Response.json({ ok: true });
}
