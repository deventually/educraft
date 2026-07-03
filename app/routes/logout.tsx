import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { logout } from "~/server/auth.server";

/** Resource route (no UI): POST destroys the session; GET just bounces to /login. */
export async function action({ request }: Route.ActionArgs) {
  return logout(request);
}

export function loader() {
  return redirect("/login");
}
