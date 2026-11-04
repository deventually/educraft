import { index, prefix } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** "Mijn werk": the teacher's saved generations. */
export const projects: RouteArea = {
  shell: [...prefix("projects", [index("routes/projects._index.tsx")])],
};
