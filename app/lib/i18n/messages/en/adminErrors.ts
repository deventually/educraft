import type { Messages } from "../nl";

export const adminErrors: Messages["adminErrors"] = {
  colPage: "Page",
  colRequestId: "Request id",
  colTime: "Time",
  details: "Technical details",
  empty: "No errors since the last restart.",
  heading: "Recent errors",
  intro:
    "The last {max} unexpected errors since the last restart, newest first. Only you, as the super admin, see this page.",
  logHint:
    "Every error is also in the server log, as one JSON line with the request id. When a teacher reports a problem, search for that id.",
  nav: "Recent errors",
};
