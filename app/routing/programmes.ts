import { index, prefix, route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** Programmes (opleidingen): bundles of courses with a year and period per course. */
export const programmes: RouteArea = {
  shell: [
    ...prefix("programmes", [
      index("routes/programmes._index.tsx"),
      route(":id", "routes/programmes.$id.tsx"),
    ]),
  ],
};
