import { route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** Auth front door — outside the AppShell layout (no nav/footer chrome). */
export const auth: RouteArea = {
  standalone: [
    route("invite/:token", "routes/invite.tsx"),
    route("reset/:token", "routes/reset.$token.tsx"),
    route("login", "routes/login.tsx"),
    // Resource route (no UI) — POST destroys the session.
    route("logout", "routes/logout.tsx"),
  ],
};
