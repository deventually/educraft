import { route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** The team lead's page (P28.2): teacher side, not under /admin. */
export const teams: RouteArea = {
  shell: [route("teams/:id", "routes/teams.$id.tsx")],
  // The lead uploads or removes the team's PowerPoint template (P30.7b); no UI of its own.
  standalone: [route("teams/:id/slide-template", "routes/teams.$id.slide-template.tsx")],
};
