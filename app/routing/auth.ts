import { route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** Auth front door — outside the AppShell layout (no nav/footer chrome). */
export const auth: RouteArea = {
  standalone: [
    route("invite/:token", "routes/invite.tsx"),
    route("reset/:token", "routes/reset.$token.tsx"),
    route("login", "routes/login.tsx"),
    // Second step for an account with two-step verification (P2-12).
    route("login/2fa", "routes/login.2fa.tsx"),
    // Resource route (no UI) — POST destroys the session.
    route("logout", "routes/logout.tsx"),
  ],
};
