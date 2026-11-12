/** One institution on the platform, as `listInstitutions` gives it (platformAdmin.server). */
export interface InstitutionRow {
  id: string;
  name: string;
  hosts: string[];
  active: boolean;
  createdAt: string;
}

/** One removed institution in the archive, as `listArchived` gives it. */
export interface ArchivedRow {
  key: string;
  id: string;
  name: string;
  hosts: string[];
  removedAt: string;
  purgeAt: string;
}

/** Why the platform refused an action; each has its own sentence in `platform.errors`. */
export type PlatformError =
  | "id"
  | "name"
  | "host"
  | "taken"
  | "exists"
  | "email"
  | "unknown"
  | "active"
  | "confirm";

/** What the `/platform` action returns. */
export type PlatformResult =
  | {
      intent: string;
      ok: true;
      name?: string;
      adminName?: string;
      setPasswordLink?: string;
    }
  | { intent: string; ok: false; error: PlatformError };
