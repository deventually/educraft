import { redirect } from "react-router";
import type { Route } from "./+types/admin._index";
import { requireRole } from "~/server/auth.server";

/**
 * `/admin` has no page of its own (P18.4): the console is four pages and the first
 * one, the user list, is where an admin lands.
 */
export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  throw redirect("/admin/users");
}

export default function AdminIndex() {
  return null;
}
