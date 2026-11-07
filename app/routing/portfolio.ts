import { index, prefix, route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** BDB/BKE workplace (brief P25). */
export const portfolio: RouteArea = {
  // 25.3: dossier list, overview, framework, one outcome.
  shell: [
    ...prefix("portfolio", [
      index("routes/portfolio._index.tsx"),
      route(":id", "routes/portfolio.$id.tsx"),
      route(":id/framework", "routes/portfolio.$id.framework.tsx"),
      route(":id/outcome/:outcomeId", "routes/portfolio.$id.outcome.$outcomeId.tsx"),
      // 29.3: the rehearsal assessment, from step 5 only.
      route(":id/rehearsal", "routes/portfolio.$id.rehearsal.tsx"),
    ]),
  ],
  // Resource route (no UI) — a dossier as a Word (.docx) download (P25.6).
  standalone: [
    route("portfolio/:id/export", "routes/portfolio.$id.export.tsx"),
    // PDF: the dossier as a print page, outside the app shell (like P30.2).
    route("portfolio/:id/print", "routes/portfolio.$id.print.tsx"),
  ],
};
