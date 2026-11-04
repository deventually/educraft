import { route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** Resource routes without UI. */
export const api: RouteArea = {
  standalone: [
    // SSE streaming endpoint for generators.
    route("api/stream", "routes/api.stream.tsx"),
    // Records tester feedback on a generation.
    route("api/feedback", "routes/api.feedback.tsx"),
    // Public health probe for orchestrators (no auth, no chrome).
    route("healthz", "routes/healthz.tsx"),
    // Persists the chosen UI locale in a cookie.
    route("set-locale", "routes/set-locale.tsx"),
    // Silences Chrome DevTools' workspace probe.
    route(".well-known/appspecific/com.chrome.devtools.json", "routes/devtools-probe.tsx"),
  ],
};
