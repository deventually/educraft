import { route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** The team lead's page (P28.2): teacher side, not under /admin. */
export const teams: RouteArea = {
  shell: [route("teams/:id", "routes/teams.$id.tsx")],
};
