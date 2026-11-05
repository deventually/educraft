import { index, route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/**
 * Admin console (Phase 4, four pages since P18.4). The layout gates on requireRole("admin"); every
 * child repeats the check (loaders run in parallel).
 */
export const admin: RouteArea = {
  shell: [
    route("admin", "routes/admin.tsx", [
      index("routes/admin._index.tsx"), // redirects to /admin/users
      route("users", "routes/admin.users.tsx"),
      route("users/:id", "routes/admin.users.$id.tsx"), // the person page (P28.1)
      route("teams", "routes/admin.teams.tsx"), // the team list (P28.2)
      route("teams/:id", "routes/admin.teams.$id.tsx"), // the team page
      route("tools", "routes/admin.tools.tsx"),
      route("agents", "routes/admin.agents.tsx"), // the role agents' switches
      route("context", "routes/admin.context.tsx"),
      route("usage", "routes/admin.usage.tsx"),
    ]),
  ],
};
