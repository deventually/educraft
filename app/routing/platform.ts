import { route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/**
 * The platform page (platformlaag, PR B): the platform owner manages the institutions. It runs
 * on the platform address (`PLATFORM_HOST`); the loader allows the owner only.
 */
export const platform: RouteArea = {
  shell: [route("platform", "routes/platform.tsx")],
};
