/**
 * PowerPoint templates (P30.7b): at most one per teacher and one per team. Repository rule:
 * a teacher reads and changes only their own; a team's template is set and removed by the
 * team's lead and read by its members, checked in the WHERE clause. The file was checked at
 * the boundary (`checkPptxTemplate`) before it gets here.
 */
import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../db.server";
import { slideTemplates, teamMembers, teams } from "../schema.server";

type OwnerKind = "user" | "team";

export interface SlideTemplateInfo {
  id: string;
  name: string;
  scope: "own" | "team";
  /** The team's name, for a team template. */
  teamName?: string;
  createdAt: Date;
}

function save(kind: OwnerKind, ownerId: string, name: string, bytes: Uint8Array): void {
  const db = getDb();
  db.transaction((tx) => {
    tx.delete(slideTemplates)
      .where(and(eq(slideTemplates.ownerKind, kind), eq(slideTemplates.ownerId, ownerId)))
      .run();
    tx.insert(slideTemplates)
      .values({
        id: randomUUID(),
        ownerKind: kind,
        ownerId,
        name: name.slice(0, 200),
        data: Buffer.from(bytes),
        size: bytes.byteLength,
        createdAt: new Date(),
      })
      .run();
  });
}

function remove(kind: OwnerKind, ownerId: string): void {
  getDb()
    .delete(slideTemplates)
    .where(and(eq(slideTemplates.ownerKind, kind), eq(slideTemplates.ownerId, ownerId)))
    .run();
}

function leads(userId: string, teamId: string): boolean {
  return !!getDb()
    .select({ lead: teamMembers.isLead })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId),
        eq(teamMembers.isLead, true),
      ),
    )
    .get();
}

export async function saveOwnTemplate(userId: string, name: string, bytes: Uint8Array) {
  save("user", userId, name, bytes);
}

export async function deleteOwnTemplate(userId: string): Promise<void> {
  remove("user", userId);
}

/** Only the team's lead; false for anyone else. */
export async function saveTeamTemplate(
  callerId: string,
  teamId: string,
  name: string,
  bytes: Uint8Array,
): Promise<boolean> {
  if (!leads(callerId, teamId)) return false;
  save("team", teamId, name, bytes);
  return true;
}

export async function deleteTeamTemplate(callerId: string, teamId: string): Promise<boolean> {
  if (!leads(callerId, teamId)) return false;
  remove("team", teamId);
  return true;
}

/** The team's template as its lead sees it on the team page; null for anyone else. */
export async function getTeamTemplate(
  callerId: string,
  teamId: string,
): Promise<{ name: string; createdAt: Date } | null> {
  if (!leads(callerId, teamId)) return null;
  return (
    getDb()
      .select({ name: slideTemplates.name, createdAt: slideTemplates.createdAt })
      .from(slideTemplates)
      .where(and(eq(slideTemplates.ownerKind, "team"), eq(slideTemplates.ownerId, teamId)))
      .get() ?? null
  );
}

/** Where the caller may read a template: their own, or one of a team they are in. */
const readableBy = (userId: string) =>
  sql`((${slideTemplates.ownerKind} = 'user' and ${slideTemplates.ownerId} = ${userId})
    or (${slideTemplates.ownerKind} = 'team' and exists (select 1 from ${teamMembers} m
      where m.team_id = ${slideTemplates.ownerId} and m.user_id = ${userId})))`;

/** The templates the caller may use: their own first, then their teams', by team name. */
export async function listTemplatesForUser(userId: string): Promise<SlideTemplateInfo[]> {
  const rows = getDb()
    .select({
      id: slideTemplates.id,
      name: slideTemplates.name,
      kind: slideTemplates.ownerKind,
      teamName: teams.name,
      createdAt: slideTemplates.createdAt,
    })
    .from(slideTemplates)
    .leftJoin(
      teams,
      and(eq(slideTemplates.ownerKind, "team"), eq(teams.id, slideTemplates.ownerId)),
    )
    .where(readableBy(userId))
    .orderBy(asc(slideTemplates.ownerKind), asc(teams.name))
    .limit(50)
    .all();
  return rows
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "user" ? -1 : 1))
    .map((r) => ({
      id: r.id,
      name: r.name,
      scope: r.kind === "user" ? ("own" as const) : ("team" as const),
      ...(r.kind === "team" && r.teamName ? { teamName: r.teamName } : {}),
      createdAt: r.createdAt,
    }));
}

/** The file, if the caller may use it; null otherwise (also for an unknown id). */
export async function getTemplateFile(userId: string, id: string): Promise<Uint8Array | null> {
  const row = getDb()
    .select({ data: slideTemplates.data })
    .from(slideTemplates)
    .where(and(eq(slideTemplates.id, id), readableBy(userId)))
    .get();
  return row ? new Uint8Array(row.data) : null;
}
