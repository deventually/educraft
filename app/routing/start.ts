import { route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** Start (P27.3): question box, this week and the teacher's courses. `/` sends a teacher here. */
export const start: RouteArea = {
  shell: [route("start", "routes/start.tsx")],
};
