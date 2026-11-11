/**
 * Announcements from the admin (the banner in the shell). The admin's functions are
 * instance-wide, like the team list (the route checks the role); a teacher's functions are
 * scoped to their own `userId` in the WHERE clause: what they are shown and what they close.
 * Repository rule: every exported function is `async`.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq, exists, gt, gte, inArray, isNull, not, or, sql } from "drizzle-orm";
import { getDb } from "../db.server";
import { announcementDismissals, announcements, teamMembers, teams, users } from "../schema.server";
import type { AnnouncementInput, AnnouncementLevel, ShownAnnouncement } from "~/lib/announcements";
import { addDays, type IsoDate } from "~/lib/calendar/weeks";

/** At most this many banners at once: more is noise. */
const SHOWN_MAX = 5;

/** Place an announcement. `null` when its team or person does not exist. */
export async function createAnnouncement(
  input: AnnouncementInput & { createdBy: string },
): Promise<{ id: string } | null> {
  const db = getDb();
  const { audience } = input;
  let targetId: string | null = null;
  if (audience.kind === "team") {
    if (!db.select({ id: teams.id }).from(teams).where(eq(teams.id, audience.teamId)).get())
      return null;
    targetId = audience.teamId;
  } else if (audience.kind === "user") {
    if (!db.select({ id: users.id }).from(users).where(eq(users.id, audience.userId)).get())
      return null;
    targetId = audience.userId;
  }
  const id = randomUUID();
  db.insert(announcements)
    .values({
      id,
      message: input.message,
      level: input.level,
      audience: audience.kind,
      targetId,
      endsOn: input.endsOn,
      remindAfterDays: input.remindAfterDays,
      createdBy: input.createdBy,
      createdAt: new Date(),
    })
    .run();
  return { id };
}

export interface AdminAnnouncement {
  id: string;
  message: string;
  level: AnnouncementLevel;
  audience: { kind: "all" } | { kind: "team" | "user"; id: string; name: string };
  endsOn: IsoDate | null;
  remindAfterDays: number | null;
}

/** Every announcement for the admin, newest first, with the team's or person's name. */
export async function listAnnouncements(limit?: number): Promise<AdminAnnouncement[]> {
  const rows = getDb()
    .select({
      a: announcements,
      teamName: teams.name,
      userName: users.name,
    })
    .from(announcements)
    .leftJoin(teams, and(eq(announcements.audience, "team"), eq(teams.id, announcements.targetId)))
    .leftJoin(users, and(eq(announcements.audience, "user"), eq(users.id, announcements.targetId)))
    .orderBy(desc(announcements.createdAt), desc(sql`${announcements}.rowid`))
    .limit(Math.min(limit ?? 50, 500))
    .all();
  return rows.map(({ a, teamName, userName }) => ({
    id: a.id,
    message: a.message,
    level: a.level as AnnouncementLevel,
    audience:
      a.audience === "team" || a.audience === "user"
        ? {
            kind: a.audience,
            id: a.targetId ?? "",
            name: (a.audience === "team" ? teamName : userName) ?? "",
          }
        : { kind: "all" },
    endsOn: a.endsOn,
    remindAfterDays: a.remindAfterDays,
  }));
}

/** Remove an announcement with everyone's dismissals of it. `false` when it was not there. */
export async function removeAnnouncement(id: string): Promise<boolean> {
  return getDb().transaction((tx) => {
    tx.delete(announcementDismissals).where(eq(announcementDismissals.announcementId, id)).run();
    return tx.delete(announcements).where(eq(announcements.id, id)).run().changes > 0;
  });
}

/** The announcements `userId` may see on `today`, dismissed or not. */
function visibleTo(userId: string, today: IsoDate) {
  const inTeam = getDb()
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));
  return and(
    or(
      eq(announcements.audience, "all"),
      and(eq(announcements.audience, "user"), eq(announcements.targetId, userId)),
      and(eq(announcements.audience, "team"), inArray(announcements.targetId, inTeam)),
    ),
    or(isNull(announcements.endsOn), gte(announcements.endsOn, today)),
  );
}

/** What `userId` is shown today: warnings first, then the newest; dismissed ones stay away. */
export async function announcementsFor(
  userId: string,
  today: IsoDate,
): Promise<ShownAnnouncement[]> {
  const db = getDb();
  const dismissed = db
    .select({ one: sql`1` })
    .from(announcementDismissals)
    .where(
      and(
        eq(announcementDismissals.announcementId, announcements.id),
        eq(announcementDismissals.userId, userId),
        or(
          isNull(announcementDismissals.hiddenUntil),
          gt(announcementDismissals.hiddenUntil, today),
        ),
      ),
    );
  return db
    .select({ id: announcements.id, message: announcements.message, level: announcements.level })
    .from(announcements)
    .where(and(visibleTo(userId, today), not(exists(dismissed))))
    .orderBy(
      sql`case when ${announcements.level} = 'warning' then 0 else 1 end`,
      desc(announcements.createdAt),
      desc(sql`${announcements}.rowid`),
    )
    .limit(SHOWN_MAX)
    .all() as ShownAnnouncement[];
}

/**
 * `userId` closes an announcement they can see. It stays away for good, or for its
 * `remindAfterDays`. `false` when there is no such announcement for them.
 */
export async function dismissAnnouncement(
  userId: string,
  id: string,
  today: IsoDate,
): Promise<boolean> {
  const db = getDb();
  const row = db
    .select({ remindAfterDays: announcements.remindAfterDays })
    .from(announcements)
    .where(and(eq(announcements.id, id), visibleTo(userId, today)))
    .get();
  if (!row) return false;
  const hiddenUntil = row.remindAfterDays ? addDays(today, row.remindAfterDays) : null;
  db.insert(announcementDismissals)
    .values({ announcementId: id, userId, hiddenUntil, dismissedAt: new Date() })
    .onConflictDoUpdate({
      target: [announcementDismissals.announcementId, announcementDismissals.userId],
      set: { hiddenUntil, dismissedAt: new Date() },
    })
    .run();
  return true;
}
