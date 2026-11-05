import { route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** Utilities without AI (P23): own small registry, found via a section on /tools (no menu item). */
export const utilities: RouteArea = {
  shell: [
    route("utilities", "routes/utilities._index.tsx"),
    // The rubric utility has its own pages (it stores data); static segments win over :slug.
    route("utilities/rubric", "routes/utilities.rubric._index.tsx"),
    route("utilities/rubric/:id", "routes/utilities.rubric.$id.tsx"),
    // A colleague's rubric, shared with your team (P28.4): read only.
    route("utilities/rubric/shared/:id", "routes/utilities.rubric.shared.$id.tsx"),
    route("utilities/rubric/:id/fill", "routes/utilities.rubric.$id.fill.tsx"),
    route("utilities/:slug", "routes/utilities.$slug.tsx"),
  ],
};
