import { index, prefix, route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** Onderwijs › Teams (plan step 5): the overview and the one team page, for every role. */
export const teams: RouteArea = {
  shell: [
    ...prefix("teams", [index("routes/teams._index.tsx"), route(":id", "routes/teams.$id.tsx")]),
  ],
  // The lead uploads or removes the team's PowerPoint template (P30.7b); no UI of its own.
  standalone: [route("teams/:id/slide-template", "routes/teams.$id.slide-template.tsx")],
};
