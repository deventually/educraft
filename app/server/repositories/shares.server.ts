/**
 * Sharing with your team (P28.4, BESLUIT-2026-11-05-5). Repository rule, extended for
 * sharing: **reading** is allowed to the owner (the item's own repository) or to a member
 * of a team the item is shared with (here), both in the WHERE clause. **Writing, linking
 * and deleting** stay with the owner: nothing in this file writes to a shared item.
 *
 * A share only counts while its owner is still in the team, and leaving a team drops the
 * leaver's shares for it (`teams.server.ts`), so a share never outlives its team or owner.
 *
 * A course is also shared by its co-owners (BESLUIT-2026-11-10-5): `owner_user_id` is then
 * the co-owner who shared it, and the share counts while that person is still in the team
 * and still co-owner. Any manager of the course (owner or co-owner) sees and stops its shares.
 */
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, ne, type SQL, sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { getDb } from "../db.server";
import {
  contextProfiles,
  courseLinks,
  courseMembers,
  courses,
  generations,
  rubrics,
  shares,
  teamMembers,
  teams,
  users,
} from "../schema.server";
import { SHAREABLE_WORK_SLUGS, SHARE_KINDS, type ShareKind } from "~/lib/sharing";
import { CourseDataSchema } from "~/lib/courses/schema";
import type { CourseData } from "~/lib/courses/types";
import { RubricDataSchema, type RubricData } from "~/lib/utilities/rubric";
import type { ContextProfile } from "~/lib/context/types";
import { migrateLegacyProfile } from "~/lib/context/migrate";
import { createCourse } from "./courses.server";
import { createRubric } from "./rubrics.server";
import { createProfile } from "./profiles.server";

const cap = (limit?: number) => Math.min(limit ?? 50, 500);

/** The table behind each kind: its id, owner and name columns. */
const ITEMS = {
  course: { table: courses, id: courses.id, owner: courses.userId, name: courses.name },
  rubric: { table: rubrics, id: rubrics.id, owner: rubrics.userId, name: rubrics.name },
  contextProfile: {
    table: contextProfiles,
    id: contextProfiles.id,
    owner: contextProfiles.userId,
    name: contextProfiles.name,
  },
} as const;

const isKind = (kind: string): kind is ShareKind =>
  (SHARE_KINDS as readonly string[]).includes(kind);

/** The sharer `sharer` may share the item: its owner, or for a course also a co-owner. */
function mayShare(
  kind: ShareKind,
  sharer: SQL | string,
  itemId: SQLiteColumn | string,
  owner: SQLiteColumn,
): SQL {
  const coOwner =
    kind === "course"
      ? sql` or exists (select 1 from ${courseMembers} cm
          where cm.course_id = ${itemId} and cm.user_id = ${sharer} and cm.role = 'co-owner')`
      : sql``;
  return sql`(${sharer} = ${owner}${coOwner})`;
}

/**
 * The read rule for a team-mate: the item is shared, by someone who may share it, with a
 * team that both the viewer and that sharer are in. A correlated condition for the item's
 * own table.
 */
function sharedWith(
  viewerId: string,
  kind: ShareKind,
  itemId: SQLiteColumn,
  ownerId: SQLiteColumn,
): SQL {
  return sql`exists (select 1 from ${shares} s
    join ${teamMembers} viewer on viewer.team_id = s.team_id and viewer.user_id = ${viewerId}
    join ${teamMembers} owner on owner.team_id = s.team_id and owner.user_id = s.owner_user_id
    where s.kind = ${kind} and s.item_id = ${itemId}
      and ${mayShare(kind, sql`s.owner_user_id`, itemId, ownerId)})`;
}

function ownsItem(userId: string, kind: ShareKind, itemId: string): boolean {
  const t = ITEMS[kind];
  return !!getDb()
    .select({ id: t.id })
    .from(t.table)
    .where(and(eq(t.id, itemId), mayShare(kind, userId, t.id, t.owner)))
    .get();
}

function isMember(userId: string, teamId: string): boolean {
  return !!getDb()
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .get();
}

// ── The owner's side ────────────────────────────────────────────────────────

/** Share an own item with a team the owner is in. False (nothing written) otherwise. */
export async function shareItem(
  ownerId: string,
  kind: ShareKind,
  itemId: string,
  teamId: string,
): Promise<boolean> {
  if (!isKind(kind) || !ownsItem(ownerId, kind, itemId) || !isMember(ownerId, teamId)) return false;
  getDb()
    .insert(shares)
    .values({ id: randomUUID(), ownerUserId: ownerId, kind, itemId, teamId, createdAt: new Date() })
    .onConflictDoNothing()
    .run();
  return true;
}

/**
 * Stop sharing with one team. A copy a colleague made stays theirs. A course's owner and
 * co-owners stop any share of it; anything else only its owner.
 */
export async function stopSharing(
  ownerId: string,
  kind: ShareKind,
  itemId: string,
  teamId: string,
): Promise<boolean> {
  if (!isKind(kind) || !ownsItem(ownerId, kind, itemId)) return false;
  const result = getDb()
    .delete(shares)
    .where(and(eq(shares.kind, kind), eq(shares.itemId, itemId), eq(shares.teamId, teamId)))
    .run();
  return result.changes > 0;
}

/** The teams this item is shared with (ids), for whoever may share it. */
export async function listItemShares(
  ownerId: string,
  kind: ShareKind,
  itemId: string,
): Promise<string[]> {
  if (!isKind(kind) || !ownsItem(ownerId, kind, itemId)) return [];
  const t = ITEMS[kind];
  return getDb()
    .selectDistinct({ teamId: shares.teamId, createdAt: shares.createdAt })
    .from(shares)
    .innerJoin(
      teamMembers,
      and(eq(teamMembers.teamId, shares.teamId), eq(teamMembers.userId, shares.ownerUserId)),
    )
    .innerJoin(t.table, eq(t.id, shares.itemId))
    .where(
      and(
        eq(shares.kind, kind),
        eq(shares.itemId, itemId),
        mayShare(kind, sql`${shares.ownerUserId}`, t.id, t.owner),
      ),
    )
    .orderBy(asc(shares.createdAt))
    .all()
    .map((r) => r.teamId);
}

// ── The team-mate's side: read and copy ─────────────────────────────────────

export interface SharedItemRef {
  id: string;
  name: string;
  ownerName: string;
  /** The teams it reaches the viewer through (usually one). */
  teamNames: string[];
}

/** "Van mijn team": what colleagues share with the viewer's teams, never the viewer's own. */
export async function listSharedWithMe(
  viewerId: string,
  kind: ShareKind,
  limit?: number,
): Promise<SharedItemRef[]> {
  const t = ITEMS[kind];
  const rows = getDb()
    .select({ id: t.id, name: t.name, ownerName: users.name })
    .from(t.table)
    .innerJoin(users, eq(users.id, t.owner))
    .where(and(ne(t.owner, viewerId), sharedWith(viewerId, kind, t.id, t.owner)))
    .orderBy(asc(t.name))
    .limit(cap(limit))
    .all();
  if (rows.length === 0) return [];
  const viaTeams = getDb()
    .select({ itemId: shares.itemId, teamName: teams.name })
    .from(shares)
    .innerJoin(teams, eq(teams.id, shares.teamId))
    .innerJoin(
      teamMembers,
      and(eq(teamMembers.teamId, shares.teamId), eq(teamMembers.userId, viewerId)),
    )
    .where(
      and(
        eq(shares.kind, kind),
        inArray(
          shares.itemId,
          rows.map((r) => r.id),
        ),
      ),
    )
    .orderBy(asc(teams.name))
    .all();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    ownerName: r.ownerName,
    teamNames: viaTeams.filter((v) => v.itemId === r.id).map((v) => v.teamName),
  }));
}

function readShared<K extends ShareKind>(viewerId: string, kind: K, id: string) {
  const t = ITEMS[kind];
  return getDb()
    .select({ row: t.table, ownerName: users.name })
    .from(t.table)
    .innerJoin(users, eq(users.id, t.owner))
    .where(and(eq(t.id, id), ne(t.owner, viewerId), sharedWith(viewerId, kind, t.id, t.owner)))
    .get();
}

export interface SharedCourse {
  id: string;
  name: string;
  ownerName: string;
  data: CourseData;
}

/** A course a colleague shares with one of the viewer's teams; null otherwise. */
export async function getSharedCourse(viewerId: string, id: string): Promise<SharedCourse | null> {
  const hit = readShared(viewerId, "course", id);
  if (!hit) return null;
  const row = hit.row as typeof courses.$inferSelect;
  return {
    id: row.id,
    name: row.name,
    ownerName: hit.ownerName,
    data: CourseDataSchema.parse(JSON.parse(row.dataJson)) as CourseData,
  };
}

export interface SharedRubric {
  id: string;
  name: string;
  ownerName: string;
  data: RubricData;
}

export async function getSharedRubric(viewerId: string, id: string): Promise<SharedRubric | null> {
  const hit = readShared(viewerId, "rubric", id);
  if (!hit) return null;
  const row = hit.row as typeof rubrics.$inferSelect;
  return {
    id: row.id,
    name: row.name,
    ownerName: hit.ownerName,
    data: RubricDataSchema.parse(JSON.parse(row.dataJson)) as RubricData,
  };
}

export async function getSharedProfile(
  viewerId: string,
  id: string,
): Promise<(ContextProfile & { ownerName: string }) | null> {
  const hit = readShared(viewerId, "contextProfile", id);
  if (!hit) return null;
  const row = hit.row as typeof contextProfiles.$inferSelect;
  const data = migrateLegacyProfile(JSON.parse(row.dataJson) as Record<string, unknown>);
  return {
    id: row.id,
    name: row.name,
    ...(data as Omit<ContextProfile, "id" | "name">),
    ownerName: hit.ownerName,
  };
}

export interface SharedWork {
  generationId: string;
  toolSlug: string;
  itemId: string | null;
  createdAt: Date;
  outputMarkdown: string;
}

/**
 * The owner's work linked to a shared course, for a team-mate: only from tools whose work
 * may be shared (`SHAREABLE_WORK_SLUGS`): never student work, a chat or dossier work.
 */
export async function listSharedCourseWork(
  viewerId: string,
  courseId: string,
  limit?: number,
): Promise<SharedWork[]> {
  const course = readShared(viewerId, "course", courseId);
  if (!course) return [];
  const ownerId = (course.row as typeof courses.$inferSelect).userId;
  return getDb()
    .select({
      generationId: generations.id,
      toolSlug: generations.toolSlug,
      itemId: courseLinks.itemId,
      createdAt: generations.createdAt,
      outputMarkdown: generations.outputMarkdown,
    })
    .from(courseLinks)
    .innerJoin(
      generations,
      and(eq(generations.id, courseLinks.generationId), eq(generations.userId, ownerId)),
    )
    .where(
      and(
        eq(courseLinks.courseId, courseId),
        eq(courseLinks.userId, ownerId),
        inArray(generations.toolSlug, [...SHAREABLE_WORK_SLUGS]),
      ),
    )
    .orderBy(desc(courseLinks.createdAt))
    .limit(cap(limit))
    .all();
}

/**
 * One piece of the owner's work, for a team-mate who may read it (P30.1, export): linked to a
 * course shared with the viewer, and from a tool whose work may be shared. Null otherwise.
 */
export async function getSharedWork(
  viewerId: string,
  generationId: string,
): Promise<typeof generations.$inferSelect | null> {
  const link = getDb()
    .select({ courseId: courseLinks.courseId })
    .from(courseLinks)
    .innerJoin(generations, eq(generations.id, courseLinks.generationId))
    .innerJoin(courses, eq(courses.id, courseLinks.courseId))
    .where(
      and(
        eq(courseLinks.generationId, generationId),
        eq(courseLinks.userId, generations.userId),
        eq(courses.userId, generations.userId),
        ne(generations.userId, viewerId),
        inArray(generations.toolSlug, [...SHAREABLE_WORK_SLUGS]),
        sharedWith(viewerId, "course", courses.id, courses.userId),
      ),
    )
    .get();
  if (!link) return null;
  return getDb().select().from(generations).where(eq(generations.id, generationId)).get() ?? null;
}

/**
 * "Maak een kopie": the viewer's own copy of a shared item. The copy has no links, no
 * shares and (for a course) no context profile, since that profile is the owner's.
 */
export async function copySharedItem(
  viewerId: string,
  kind: ShareKind,
  id: string,
): Promise<string | null> {
  if (kind === "course") {
    const course = await getSharedCourse(viewerId, id);
    if (!course) return null;
    return (await createCourse(viewerId, { name: course.name, data: course.data })).id;
  }
  if (kind === "rubric") {
    const rubric = await getSharedRubric(viewerId, id);
    if (!rubric) return null;
    return (await createRubric(viewerId, rubric.name, rubric.data)).id;
  }
  const profile = await getSharedProfile(viewerId, id);
  if (!profile) return null;
  const { id: _id, ownerName: _owner, ...input } = profile;
  return (await createProfile(viewerId, input, false)).id;
}
