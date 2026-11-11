/**
 * The pages the browser tests open, as data: who opens it and where. `tests/e2e-setup.test.ts`
 * checks each path against the route table, so a renamed route fails fast in `npm test`.
 */
export type Role = "guest" | "teacher" | "admin";

export type E2EPage = { path: string; as: Role };

export const PAGES: E2EPage[] = [
  { path: "/login", as: "guest" },
  { path: "/start", as: "teacher" },
  { path: "/tools", as: "teacher" },
  { path: "/tools/clear-assignment", as: "teacher" },
  { path: "/courses", as: "teacher" },
  { path: "/programmes", as: "teacher" },
  { path: "/projects", as: "teacher" },
  { path: "/utilities", as: "teacher" },
  { path: "/help", as: "teacher" },
  { path: "/about", as: "teacher" },
  { path: "/account", as: "teacher" },
  { path: "/account/2fa", as: "teacher" },
  { path: "/context-profiles", as: "teacher" },
  { path: "/assessment-models", as: "teacher" },
  { path: "/usage", as: "teacher" },
  { path: "/usage", as: "admin" },
  { path: "/admin/users", as: "admin" },
  { path: "/admin/tools", as: "admin" },
  { path: "/admin/audit", as: "admin" },
  // The dossier is off by default for a teacher; an admin always has it.
  { path: "/portfolio", as: "admin" },
];
