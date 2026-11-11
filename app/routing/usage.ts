import { route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** AI use and costs (PR C): one page for every role; the server decides who sees what. */
export const usage: RouteArea = {
  shell: [route("usage", "routes/usage.tsx")],
};
