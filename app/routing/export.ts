import { route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** Exporting a result (brief P30). Resource routes, no UI of their own. */
export const exporting: RouteArea = {
  standalone: [
    // 30.1: the preview (an ExportDoc as data) and the file download per format.
    route("work/:generationId/export", "routes/work.$generationId.export.tsx"),
    route("work/:generationId/export/:format", "routes/work.$generationId.export.$format.tsx"),
  ],
};
