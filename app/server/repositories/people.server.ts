/**
 * Repository rule (Phase 1): all DB access goes through repositories; every
 * exported signature is `async` and returns a Promise; no better-sqlite3 API is
 * used outside `db.server.ts`.
 */
import {
  type AnyColumn,
  type SQL,
  and,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "../db.server";
import { invites, teamMembers, users } from "../schema.server";
import type { Role } from "~/lib/registry/access";

/** Where a person stands on the admin list (P28.1). */
export type PersonStatus = "active" | "invited" | "disabled";

/**
 * One row of the admin user list (P28.1): an account, or an open invite (`id` is then
 * the invite token). `lastActiveDay` is the newest usage day, null when never used.
 */
export interface PersonRow {
  kind: "user" | "invite";
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status: PersonStatus;
  lastActiveDay: string | null;
  createdAt: Date;
}

export interface PeopleFilter {
  /** Part of a name or e-mail address (an invite: its note), case-insensitive. */
  q?: string;
  role?: Role;
  status?: PersonStatus;
  /** Members of this team, and open invites for it (P28.2). */
  teamId?: string;
  limit?: number;
}

/** `haystack` contains `needle`, case-insensitively, with no LIKE wildcards. */
const contains = (haystack: SQL | AnyColumn, needle: string) =>
  sql`instr(lower(coalesce(${haystack}, '')), ${needle.toLowerCase()}) > 0`;

/**
 * The admin user list (P28.1): accounts and open invites (not used, not expired), filtered
 * on the server, open invites first, then newest first. Capped at `Math.min(limit ?? 50, 500)`.
 * Not user-scoped by design (an admin sees every account and invite).
 */
export async function listPeople(filter: PeopleFilter): Promise<PersonRow[]> {
  const cap = Math.min(filter.limit ?? 50, 500);
  const q = filter.q?.trim() ?? "";
  const db = getDb();
  const out: PersonRow[] = [];

  // An invite only ever makes a teacher (BESLUIT-2026-07-03-2).
  const wantInvites =
    (!filter.status || filter.status === "invited") && (!filter.role || filter.role === "teacher");
  if (wantInvites) {
    const open = and(
      isNull(invites.usedByUserId),
      or(isNull(invites.expiresAt), gt(invites.expiresAt, new Date())),
      q ? contains(invites.note, q) : undefined,
      filter.teamId ? eq(invites.teamId, filter.teamId) : undefined,
    );
    for (const i of db
      .select()
      .from(invites)
      .where(open)
      .orderBy(desc(invites.createdAt))
      .limit(cap)
      .all()) {
      out.push({
        kind: "invite",
        id: i.token,
        name: i.note,
        email: null,
        role: i.role,
        status: "invited",
        lastActiveDay: null,
        createdAt: i.createdAt,
      });
    }
  }

  if (filter.status !== "invited" && out.length < cap) {
    const where = and(
      filter.role ? eq(users.role, filter.role) : undefined,
      filter.status === "active" ? isNull(users.disabledAt) : undefined,
      filter.status === "disabled" ? isNotNull(users.disabledAt) : undefined,
      q ? or(contains(users.name, q), contains(users.email, q)) : undefined,
      filter.teamId
        ? inArray(
            users.id,
            db
              .select({ id: teamMembers.userId })
              .from(teamMembers)
              .where(eq(teamMembers.teamId, filter.teamId)),
          )
        : undefined,
    );
    const rows = db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        disabledAt: users.disabledAt,
        createdAt: users.createdAt,
        // Fully qualified: inside a subquery drizzle would print bare column names.
        lastActiveDay: sql<
          string | null
        >`(select max(usage.day) from usage where usage.user_id = users.id)`,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(cap - out.length)
      .all();
    for (const u of rows) {
      out.push({
        kind: "user",
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.disabledAt ? "disabled" : "active",
        lastActiveDay: u.lastActiveDay ?? null,
        createdAt: u.createdAt,
      });
    }
  }
  return out;
}

/**
 * Which of these e-mail addresses are already spoken for (P28.5): `taken` has an account
 * (compared case-insensitively), `invited` has an open invite whose note ends in
 * `<email>` (the shape a pasted list writes). Not user-scoped by design: it serves the
 * admin's "Add", like `listPeople`. Input is capped at 500 addresses.
 */
export async function findClaimedEmails(
  emails: string[],
): Promise<{ taken: Set<string>; invited: Set<string> }> {
  const wanted = [...new Set(emails.map((e) => e.toLowerCase()))].slice(0, 500);
  const taken = new Set<string>();
  const invited = new Set<string>();
  if (wanted.length === 0) return { taken, invited };
  const db = getDb();
  for (const u of db
    .select({ email: users.email })
    .from(users)
    .where(inArray(sql`lower(${users.email})`, wanted))
    .all()) {
    if (u.email) taken.add(u.email.toLowerCase());
  }
  const open = db
    .select({ note: invites.note })
    .from(invites)
    .where(
      and(
        isNull(invites.usedByUserId),
        or(isNull(invites.expiresAt), gt(invites.expiresAt, new Date())),
        isNotNull(invites.note),
      ),
    )
    .all();
  const wantedSet = new Set(wanted);
  for (const { note } of open) {
    const m = note?.match(/<([^<>\s]+)>\s*$/);
    const email = m?.[1]?.toLowerCase();
    if (email && wantedSet.has(email)) invited.add(email);
  }
  return { taken, invited };
}
