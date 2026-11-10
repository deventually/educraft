import { route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** The teacher's own settings: education context, assessment models and account. */
export const account: RouteArea = {
  shell: [
    route("context-profiles", "routes/context-profiles.tsx"),
    // Frameworks per document type for the assessment tool.
    route("assessment-models", "routes/assessment-models.tsx"),
    route("account", "routes/account.tsx"),
    // Two-step verification (P2-12).
    route("account/2fa", "routes/account.2fa.tsx"),
  ],
};
