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
  standalone: [
    // The calendar file (P22.4): a download, outside the app shell.
    route("courses/:id/calendar.ics", "routes/courses.$id.calendar.tsx"),
    // A document of the whole course (the module guide): preview, file, print page.
    ...prefix("courses/:id/documents/:document", [
      route("export", "routes/courses.$id.documents.$document.export.tsx"),
      route("export/:format", "routes/courses.$id.documents.$document.export.$format.tsx"),
      route("print", "routes/courses.$id.documents.$document.print.tsx"),
    ]),
    // A document of one test (the blueprint, the marking model): preview, file, print page.
    ...prefix("courses/:id/assessments/:assessmentId/:document", [
      route("export", "routes/courses.$id.assessments.$assessmentId.$document.export.tsx"),
      route(
        "export/:format",
        "routes/courses.$id.assessments.$assessmentId.$document.export.$format.tsx",
      ),
      route("print", "routes/courses.$id.assessments.$assessmentId.$document.print.tsx"),
    ]),
  ],
};
