import { route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** The tool catalogue lives at /tools (home.tsx); individual tools at /tools/:slug. */
export const tools: RouteArea = {
  shell: [route("tools", "routes/home.tsx"), route("tools/:slug", "routes/tool.tsx")],
};
