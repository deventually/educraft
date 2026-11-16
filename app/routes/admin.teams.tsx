import { redirect } from "react-router";
import type { Route } from "./+types/admin.teams";
import { requireRole } from "~/server/auth.server";

/** The team list moved to Onderwijs › Teams (plan step 5); old links and bookmarks follow. */
export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  return redirect(`/teams${new URL(request.url).search}`);
}
