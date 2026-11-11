import { route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** Resource routes without UI. */
export const api: RouteArea = {
  standalone: [
    // SSE streaming endpoint for generators.
    route("api/stream", "routes/api.stream.tsx"),
    // Records tester feedback on a generation.
    route("api/feedback", "routes/api.feedback.tsx"),
    // Stops the teacher's own AI action when they leave the page and choose "Stop".
    route("api/ai-cancel", "routes/api.ai-cancel.tsx"),
    // The caller's monthly AI limit as a share, for the toast at 80% and 100%.
    route("api/ai-limit", "routes/api.ai-limit.tsx"),
    // Dictation: one recording in, its text out (speech server from config/models.json).
    route("api/transcribe", "routes/api.transcribe.tsx"),
    // Closes an announcement banner for the signed-in user.
    route("api/announcements/dismiss", "routes/api.announcements.dismiss.tsx"),
    // Stores or dismisses a teacher's periodic pilot check-in.
    route("api/checkin", "routes/api.checkin.tsx"),
    // Public health probe for orchestrators (no auth, no chrome).
    route("healthz", "routes/healthz.tsx"),
    // Persists the chosen UI locale in a cookie.
    route("set-locale", "routes/set-locale.tsx"),
    // Silences Chrome DevTools' workspace probe.
    route(".well-known/appspecific/com.chrome.devtools.json", "routes/devtools-probe.tsx"),
  ],
};
