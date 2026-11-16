import { redirect } from "react-router";
import type { Route } from "./+types/admin.teams.$id";
import { requireRole } from "~/server/auth.server";

/** A team's page is `/teams/:id` for every role now (plan step 5); old links follow. */
export async function loader({ request, params }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  return redirect(`/teams/${encodeURIComponent(params.id)}`);
}
