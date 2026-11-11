import type { Route } from "./+types/api.announcements.dismiss";
import { z } from "zod";
import { requireUser } from "~/server/auth.server";
import { dismissAnnouncement } from "~/server/repositories/announcements.server";
import { DEFAULT_TIME_ZONE, todayIn } from "~/lib/calendar/weeks";

const DismissSchema = z.object({ id: z.string().min(1).max(100) });

/**
 * Resource route (no UI): the signed-in user closes an announcement banner. Validated at the
 * boundary; stored under the caller's own id, and only for an announcement they can see.
 */
export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const parsed = DismissSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });

  const ok = await dismissAnnouncement(
    user.id,
    parsed.data.id,
    todayIn(DEFAULT_TIME_ZONE, new Date()),
  );
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
