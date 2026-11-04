import { index, prefix, route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** Help pages. */
export const help: RouteArea = {
  shell: [...prefix("help", [index("routes/help._index.tsx"), route(":id", "routes/help.$id.tsx")])],
};
