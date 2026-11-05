import { index, prefix, route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** Courses and the alignment spine (brief P20). */
export const courses: RouteArea = {
  shell: [
    ...prefix("courses", [
      index("routes/courses._index.tsx"),
      route(":id", "routes/courses.$id.tsx"),
    ]),
  ],
};
