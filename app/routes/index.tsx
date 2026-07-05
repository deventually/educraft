import { redirect } from "react-router";
import type { Route } from "./+types/index";
import { requireUser } from "~/server/auth.server";
import { getEffectiveRole } from "~/server/roleView.server";

/**
 * The home route (`/`) is a role-aware redirector: an admin lands on the admin
 * console (their home is the console), everyone else on the tool catalogue at
 * `/tools`. An admin "viewing as teacher" resolves to a teacher, so they see the
 * catalogue too.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const role = getEffectiveRole(user, request);
  throw redirect(role === "admin" ? "/admin" : "/tools");
}

export default function Index() {
  return null;
}
