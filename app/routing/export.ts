import { route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** Exporting a result (brief P30): resource routes, and the print page for PDF. */
export const exporting: RouteArea = {
  standalone: [
    // 30.1: the preview (an ExportDoc as data) and the file download per format.
    route("work/:generationId/export", "routes/work.$generationId.export.tsx"),
    route("work/:generationId/export/:format", "routes/work.$generationId.export.$format.tsx"),
    // 30.2: PDF through the browser's print window, outside the app shell (no menu).
    route("work/:generationId/print", "routes/work.$generationId.print.tsx"),
  ],
};
