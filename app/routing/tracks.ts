import { index, prefix, route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** The internship and thesis track alongside OnStage (brief P38); off until switched on. */
export const tracks: RouteArea = {
  shell: [
    ...prefix("tracks", [index("routes/tracks._index.tsx"), route(":id", "routes/tracks.$id.tsx")]),
  ],
};
