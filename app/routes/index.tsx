import { redirect } from "react-router";
import type { Route } from "./+types/index";
import { requireUser } from "~/server/auth.server";

/**
 * The home route (`/`) is a role-aware redirector: an admin lands on the user list of the admin
 * console (their home is the console), everyone else on the tool catalogue at
 * `/tools`.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  throw redirect(user.role === "admin" ? "/admin/users" : "/tools");
}

export default function Index() {
  return null;
}
