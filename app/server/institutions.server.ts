/**
 * The platform's list of institutions (platform layer, BESLUIT-2026-11-12-5): which institutions
 * exist, on which address, on which database, and whether they are active. With `PLATFORM_HOST`
 * set, this list replaces `TENANTS`; the platform owner changes it on /platform, without a
 * restart.
 *
 * Stored as `institutions.json` in the data folder, next to the databases. A plain file on
 * purpose: it is a handful of rows, read once and kept in memory, and it must not live inside any
 * institution's database (the database is the institution's boundary). Written atomically
 * (temp file + rename). On the first start it takes over the institutions of `TENANTS`.
 *
 * The platform itself is a tenant too (`id: "platform"`): its own database holds the platform
 * owner's account, so login, two-step verification and the reset scripts work as everywhere.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { z } from "zod";
import type { Tenant } from "./tenants.server";

const PLATFORM_ID = "platform";
const FILE = "institutions.json";
const ID = /^[a-z][a-z0-9-]{1,30}$/;
const HOST = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/;

const InstitutionSchema = z.object({
  id: z.string().regex(ID),
  name: z.string().min(1).max(100),
  hosts: z.array(z.string().min(1)).min(1),
  dbPath: z.string().min(1),
  active: z.boolean(),
  createdAt: z.string(),
});
export type Institution = z.infer<typeof InstitutionSchema>;

const StoreSchema = z.object({ institutions: z.array(InstitutionSchema) });

/** What the archive remembers of a removed institution, to show it and put it back. */
const ArchivedSchema = InstitutionSchema.extend({ removedAt: z.string() });

/** How long a removed institution stays in the archive (BESLUIT-2026-11-12-5). */
const ARCHIVE_DAYS = 60;
const DAY = 24 * 60 * 60 * 1000;
const ARCHIVE_KEY = /^[a-z][a-z0-9-]{1,30}-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/;
const ABOUT = "institution.json";

export interface ArchivedInstitution {
  key: string;
  id: string;
  name: string;
  hosts: string[];
  removedAt: string;
  purgeAt: string;
}

type AddError = "id" | "name" | "host" | "taken" | "exists";
type RemoveError = "unknown" | "active" | "confirm";

/** `2026-11-12T10-00-00Z`: sortable and safe on every filesystem. */
const stamp = (now: Date) => `${now.toISOString().slice(0, 19).replace(/:/g, "-")}Z`;

/** Moves `from` into `dir` (keeping its name) when it exists. */
function moveInto(from: string, dir: string, name: string): void {
  if (!existsSync(from)) return;
  mkdirSync(dir, { recursive: true });
  renameSync(from, join(dir, name));
}

export function institutionRegistry(opts: {
  dir: string;
  platformHost: string;
  seed?: readonly Tenant[];
}) {
  const file = join(opts.dir, FILE);
  const platformHost = opts.platformHost.trim().toLowerCase();
  const platform: Tenant = {
    id: PLATFORM_ID,
    hosts: [platformHost],
    dbPath: join(opts.dir, "platform.db"),
    platform: true,
  };

  function read(): Institution[] {
    if (!existsSync(file)) return [];
    try {
      return StoreSchema.parse(JSON.parse(readFileSync(file, "utf8"))).institutions;
    } catch (error) {
      throw new Error(
        `${file} is not a valid list of institutions: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  function write(next: Institution[]): void {
    mkdirSync(opts.dir, { recursive: true });
    const temp = `${file}.writing`;
    writeFileSync(temp, `${JSON.stringify({ institutions: next }, null, 2)}\n`);
    renameSync(temp, file);
    institutions = next;
  }

  let institutions = read();
  if (!existsSync(file) && opts.seed?.length) {
    write(
      opts.seed
        .filter((t) => t.id !== PLATFORM_ID && t.hosts.length > 0)
        .map((t) => ({
          id: t.id,
          name: t.name ?? t.id,
          hosts: t.hosts,
          dbPath: t.dbPath,
          active: true,
          createdAt: new Date().toISOString(),
        })),
    );
  }

  const archiveDir = join(opts.dir, "archive");

  /** Every readable archive entry; anything else in the folder is left alone. */
  function archiveEntries() {
    if (!existsSync(archiveDir)) return [];
    return readdirSync(archiveDir)
      .filter((key) => ARCHIVE_KEY.test(key))
      .flatMap((key) => {
        const path = join(archiveDir, key);
        try {
          const about = ArchivedSchema.parse(JSON.parse(readFileSync(join(path, ABOUT), "utf8")));
          return [{ key, path, about }];
        } catch {
          return [];
        }
      })
      .sort((a, b) => a.about.removedAt.localeCompare(b.about.removedAt));
  }

  const usedHosts = () => new Set([platformHost, ...institutions.flatMap((i) => i.hosts)]);

  return {
    /** The institutions, in the order they were added. */
    list(): Institution[] {
      return institutions.map((i) => ({ ...i, hosts: [...i.hosts] }));
    },

    /** The platform plus every institution, as the request router and the jobs see them. */
    tenants(): Tenant[] {
      return [
        platform,
        ...institutions.map((i) => ({
          id: i.id,
          name: i.name,
          hosts: [...i.hosts],
          dbPath: i.dbPath,
          ...(i.active ? {} : { inactive: true }),
        })),
      ];
    },

    /** A new, active institution with its own database file (created on first use). */
    add(input: {
      id: string;
      name: string;
      host: string;
    }): { ok: true; institution: Institution } | { ok: false; error: AddError } {
      const id = input.id.trim();
      const name = input.name.trim();
      const host = input.host.trim().toLowerCase();
      if (!ID.test(id) || id === PLATFORM_ID) return { ok: false, error: "id" };
      if (!name || name.length > 100) return { ok: false, error: "name" };
      if (!HOST.test(host)) return { ok: false, error: "host" };
      if (institutions.some((i) => i.id === id) || usedHosts().has(host)) {
        return { ok: false, error: "taken" };
      }
      const dbPath = join(opts.dir, `${id}.db`);
      if (existsSync(dbPath)) return { ok: false, error: "exists" };
      const institution: Institution = {
        id,
        name,
        hosts: [host],
        dbPath,
        active: true,
        createdAt: new Date().toISOString(),
      };
      write([...institutions, institution]);
      return { ok: true, institution };
    },

    /** Activate or deactivate; `false` for an unknown id. */
    setActive(id: string, active: boolean): boolean {
      if (!institutions.some((i) => i.id === id)) return false;
      write(institutions.map((i) => (i.id === id ? { ...i, active } : i)));
      return true;
    },

    /**
     * Remove a deactivated institution, confirmed by typing its id. Its database (with its
     * -wal/-shm) and its backups move to `archive/<id>-<time>/`; nothing is deleted here.
     * The caller closes the database first.
     */
    remove(
      id: string,
      confirm: string,
      now = new Date(),
      backupDir: string | null = null,
    ): { ok: true; archivedTo: string } | { ok: false; error: RemoveError } {
      const institution = institutions.find((i) => i.id === id);
      if (!institution) return { ok: false, error: "unknown" };
      if (institution.active) return { ok: false, error: "active" };
      if (confirm.trim() !== id) return { ok: false, error: "confirm" };
      const archivedTo = join(opts.dir, "archive", `${id}-${stamp(now)}`);
      mkdirSync(archivedTo, { recursive: true });
      const base = basename(institution.dbPath);
      for (const suffix of ["", "-wal", "-shm"]) {
        moveInto(`${institution.dbPath}${suffix}`, archivedTo, `${base}${suffix}`);
      }
      if (backupDir) moveInto(backupDir, archivedTo, "backups");
      const about = { ...institution, removedAt: now.toISOString() };
      writeFileSync(join(archivedTo, ABOUT), `${JSON.stringify(about, null, 2)}\n`);
      write(institutions.filter((i) => i.id !== id));
      return { ok: true, archivedTo };
    },

    /** The removed institutions still in the archive, oldest first. */
    archived(now = new Date()): ArchivedInstitution[] {
      return archiveEntries()
        .map(({ key, about }) => ({
          key,
          id: about.id,
          name: about.name,
          hosts: about.hosts,
          removedAt: about.removedAt,
          purgeAt: new Date(Date.parse(about.removedAt) + ARCHIVE_DAYS * DAY).toISOString(),
        }))
        .filter((a) => Date.parse(a.purgeAt) > now.getTime());
    },

    /**
     * Put an archived institution back, deactivated, on its old database and address (the
     * owner checks it, then activates it). Refused when its id, address or file is in use.
     */
    restore(
      key: string,
      backupDir: string | null = null,
    ): { ok: true } | { ok: false; error: "unknown" | "taken" } {
      const entry = archiveEntries().find((e) => e.key === key);
      if (!entry) return { ok: false, error: "unknown" };
      const { about, path } = entry;
      if (
        institutions.some((i) => i.id === about.id) ||
        about.hosts.some((h) => usedHosts().has(h)) ||
        existsSync(about.dbPath)
      ) {
        return { ok: false, error: "taken" };
      }
      const base = basename(about.dbPath);
      for (const suffix of ["", "-wal", "-shm"]) {
        const from = join(path, `${base}${suffix}`);
        if (existsSync(from)) renameSync(from, `${about.dbPath}${suffix}`);
      }
      const backups = join(path, "backups");
      if (backupDir && existsSync(backups) && !existsSync(backupDir)) {
        mkdirSync(join(backupDir, ".."), { recursive: true });
        renameSync(backups, backupDir);
      }
      rmSync(path, { recursive: true, force: true });
      const { removedAt: _, ...institution } = about;
      write([...institutions, { ...institution, active: false }]);
      return { ok: true };
    },

    /** Wipe for good what has been in the archive for 60 days; the keys that went. */
    purgeArchive(now = new Date()): string[] {
      const gone = archiveEntries().filter(
        (e) => Date.parse(e.about.removedAt) + ARCHIVE_DAYS * DAY <= now.getTime(),
      );
      for (const e of gone) rmSync(e.path, { recursive: true, force: true });
      return gone.map((e) => e.key);
    },
  };
}

export type InstitutionRegistry = ReturnType<typeof institutionRegistry>;
