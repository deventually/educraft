import type { Role } from "./pages";

/** The accounts `seed.ts` creates in the throwaway e2e database. Test-only, never real people. */
export const USERS: Record<
  Exclude<Role, "guest">,
  { name: string; email: string; password: string }
> = {
  teacher: { name: "E2E Docent", email: "docent@e2e.test", password: "e2e-docent-wachtwoord-1" },
  admin: { name: "E2E Beheerder", email: "beheer@e2e.test", password: "e2e-beheer-wachtwoord-1" },
};
