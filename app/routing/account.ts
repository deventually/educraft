import { route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** The teacher's own settings: education context and account. */
export const account: RouteArea = {
  shell: [route("context-profiles", "routes/context-profiles.tsx"), route("account", "routes/account.tsx")],
};
