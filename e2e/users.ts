import type { Role } from "./pages";

/** The accounts `seed.ts` creates in the throwaway e2e database. Test-only, never real people. */
export const USERS: Record<
  Exclude<Role, "guest">,
  { name: string; email: string; password: string }
> = {
  teacher: { name: "E2E Docent", email: "docent@e2e.test", password: "e2e-docent-wachtwoord-1" },
  admin: { name: "E2E Beheerder", email: "beheer@e2e.test", password: "e2e-beheer-wachtwoord-1" },
};

/** Where `seed.ts` leaves the admin's two-step verification secret (git-ignored). */
export const ADMIN_TOTP_FILE = "e2e/.data/admin-totp";

/** Where `auth.setup.ts` saves each role's signed-in browser state (git-ignored). */
export const storageStateOf = (role: Exclude<Role, "guest">) => `e2e/.data/${role}.json`;
