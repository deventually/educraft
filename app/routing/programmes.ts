import { index, prefix, route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** Programmes (opleidingen) and their learning lines (leerlijnen). */
export const programmes: RouteArea = {
  shell: [
    ...prefix("programmes", [
      index("routes/programmes._index.tsx"),
      route(":id", "routes/programmes.$id.tsx"),
      route(":id/lines/:lineId", "routes/programmes.$id.lines.$lineId.tsx"),
    ]),
  ],
};
