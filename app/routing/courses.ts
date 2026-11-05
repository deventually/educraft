import { index, prefix, route } from "@react-router/dev/routes";
import type { RouteArea } from "./types";

/** Courses and the alignment spine (brief P20). */
export const courses: RouteArea = {
  shell: [
    ...prefix("courses", [
      index("routes/courses._index.tsx"),
      // A colleague's course, shared with your team (P28.4): read only.
      route("shared/:id", "routes/courses.shared.$id.tsx"),
      route(":id", "routes/courses.$id.tsx"),
    ]),
  ],
  // The calendar file (P22.4): a download, outside the app shell.
  standalone: [route("courses/:id/calendar.ics", "routes/courses.$id.calendar.tsx")],
};
