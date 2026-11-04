import { route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** Static information pages. */
export const info: RouteArea = {
  shell: [
    route("about", "routes/about.tsx"),
    route("cookies", "routes/cookies.tsx"),
    route("legal", "routes/legal.tsx"),
  ],
};
