import { z } from "zod";
import { type IsoDate, IsoDateSchema } from "~/lib/calendar/weeks";

/**
 * Announcements from the admin (banner in the shell): one text for everyone, one team or one
 * person, an optional last day, and an optional number of days after which a dismissed
 * announcement comes back. Pure: the form is parsed here, stored in
 * `repositories/announcements.server.ts`.
 */
export const ANNOUNCEMENT_MAX = 500;
export const REMIND_MAX_DAYS = 30;

export const ANNOUNCEMENT_LEVELS = ["info", "warning"] as const;
export type AnnouncementLevel = (typeof ANNOUNCEMENT_LEVELS)[number];

export type Audience =
  | { kind: "all" }
  | { kind: "team"; teamId: string }
  | { kind: "user"; userId: string };

export interface AnnouncementInput {
  message: string;
  level: AnnouncementLevel;
  audience: Audience;
  /** The last day it shows (inclusive), or `null` until the admin removes it. */
  endsOn: IsoDate | null;
  /** Days a dismissed announcement stays away, or `null` for good. */
  remindAfterDays: number | null;
}

/** What a teacher's banner gets: never who posted it or who else sees it. */
export interface ShownAnnouncement {
  id: string;
  message: string;
  level: AnnouncementLevel;
}

export type AnnouncementFormError =
  | "invalid"
  | "messageRequired"
  | "teamRequired"
  | "userRequired"
  | "endsInPast";

const id = z.string().trim().max(100);

const FormSchema = z.object({
  message: z.string().trim().max(ANNOUNCEMENT_MAX),
  level: z.enum(ANNOUNCEMENT_LEVELS),
  audience: z.enum(["all", "team", "user"]),
  teamId: id.optional(),
  userId: id.optional(),
  endsOn: z.union([z.literal(""), IsoDateSchema]),
  remindAfterDays: z.union([z.literal(""), z.coerce.number().int().min(1).max(REMIND_MAX_DAYS)]),
});

const field = (fd: FormData, name: string) => {
  const v = fd.get(name);
  return typeof v === "string" ? v : undefined;
};

/** Parse the admin's form. `today` is the institution's date (`todayIn`). */
export function parseAnnouncementForm(
  fd: FormData,
  today: IsoDate,
): { ok: true; value: AnnouncementInput } | { ok: false; error: AnnouncementFormError } {
  const parsed = FormSchema.safeParse({
    message: field(fd, "message") ?? "",
    level: field(fd, "level"),
    audience: field(fd, "audience"),
    teamId: field(fd, "teamId"),
    userId: field(fd, "userId"),
    endsOn: field(fd, "endsOn") ?? "",
    remindAfterDays: field(fd, "remindAfterDays") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const f = parsed.data;
  if (!f.message) return { ok: false, error: "messageRequired" };
  if (f.endsOn && f.endsOn < today) return { ok: false, error: "endsInPast" };

  let audience: Audience = { kind: "all" };
  if (f.audience === "team") {
    if (!f.teamId) return { ok: false, error: "teamRequired" };
    audience = { kind: "team", teamId: f.teamId };
  } else if (f.audience === "user") {
    if (!f.userId) return { ok: false, error: "userRequired" };
    audience = { kind: "user", userId: f.userId };
  }

  return {
    ok: true,
    value: {
      message: f.message,
      level: f.level,
      audience,
      endsOn: f.endsOn || null,
      remindAfterDays: f.remindAfterDays === "" ? null : f.remindAfterDays,
    },
  };
}
