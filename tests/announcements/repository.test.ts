import { beforeAll, describe, expect, it } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let repo: typeof import("~/server/repositories/announcements.server");
let teams: typeof import("~/server/repositories/teams.server");
let users: typeof import("~/server/repositories/users.server");

const TODAY = "2026-11-11";

beforeAll(async () => {
  repo = await import("~/server/repositories/announcements.server");
  teams = await import("~/server/repositories/teams.server");
  users = await import("~/server/repositories/users.server");
});

let n = 0;
/** An admin, a team with Anna in it, and Bram outside it. */
async function world() {
  n += 1;
  const mk = (who: string, role: "teacher" | "admin" = "teacher") =>
    users.createUser({ id: `${who}-${n}`, name: `${who} ${n}`, passwordHash: "x", role });
  const [admin, anna, bram] = await Promise.all([mk("admin", "admin"), mk("anna"), mk("bram")]);
  const team = await teams.createTeam(`Team ${n}`);
  await teams.addMember(team.id, anna.id);
  return { admin: admin.id, anna: anna.id, bram: bram.id, team: team.id };
}

const post = (
  createdBy: string,
  audience: import("~/lib/announcements").Audience,
  extra: Partial<{
    message: string;
    level: "info" | "warning";
    endsOn: string | null;
    remindAfterDays: number | null;
  }> = {},
) =>
  repo.createAnnouncement({
    message: extra.message ?? "Onderhoud vanavond",
    level: extra.level ?? "info",
    endsOn: extra.endsOn ?? null,
    remindAfterDays: extra.remindAfterDays ?? null,
    audience,
    createdBy,
  });

const shownTo = async (userId: string) =>
  (await repo.announcementsFor(userId, TODAY)).map((a) => a.message);

describe("announcements repository", () => {
  it("shows an announcement for everyone to every user", async () => {
    const w = await world();
    await post(w.admin, { kind: "all" }, { message: `Voor iedereen ${n}` });
    expect(await shownTo(w.anna)).toContain(`Voor iedereen ${n}`);
    expect(await shownTo(w.bram)).toContain(`Voor iedereen ${n}`);
  });

  it("shows a team announcement only to that team's members", async () => {
    const w = await world();
    await post(w.admin, { kind: "team", teamId: w.team }, { message: `Team ${n}` });
    expect(await shownTo(w.anna)).toContain(`Team ${n}`);
    expect(await shownTo(w.bram)).not.toContain(`Team ${n}`);
  });

  it("shows a personal announcement only to that person", async () => {
    const w = await world();
    await post(w.admin, { kind: "user", userId: w.bram }, { message: `Bram ${n}` });
    expect(await shownTo(w.bram)).toContain(`Bram ${n}`);
    expect(await shownTo(w.anna)).not.toContain(`Bram ${n}`);
  });

  it("refuses a team or person that does not exist", async () => {
    const w = await world();
    expect(await post(w.admin, { kind: "team", teamId: "nope" })).toBeNull();
    expect(await post(w.admin, { kind: "user", userId: "nope" })).toBeNull();
  });

  it("shows an announcement up to and including its last day, never after", async () => {
    const w = await world();
    await post(w.admin, { kind: "user", userId: w.anna }, { message: "vandaag", endsOn: TODAY });
    await post(
      w.admin,
      { kind: "user", userId: w.anna },
      { message: "gisteren", endsOn: "2026-11-10" },
    );
    const shown = await shownTo(w.anna);
    expect(shown).toContain("vandaag");
    expect(shown).not.toContain("gisteren");
  });

  it("puts warnings first, then the newest", async () => {
    const w = await world();
    await post(w.admin, { kind: "user", userId: w.anna }, { message: "oud" });
    await post(w.admin, { kind: "user", userId: w.anna }, { message: "let op", level: "warning" });
    await post(w.admin, { kind: "user", userId: w.anna }, { message: "nieuw" });
    const mine = ["oud", "let op", "nieuw"];
    expect((await shownTo(w.anna)).filter((m) => mine.includes(m))).toEqual([
      "let op",
      "nieuw",
      "oud",
    ]);
  });

  it("hides a dismissed announcement for that user only", async () => {
    const w = await world();
    const a = await post(w.admin, { kind: "all" }, { message: `weg ${n}` });
    expect(await repo.dismissAnnouncement(w.anna, a!.id, TODAY)).toBe(true);
    expect(await shownTo(w.anna)).not.toContain(`weg ${n}`);
    expect(await shownTo(w.bram)).toContain(`weg ${n}`);
  });

  it("brings a dismissed announcement back after its interval, until its last day", async () => {
    const w = await world();
    const a = await post(
      w.admin,
      { kind: "user", userId: w.anna },
      { message: "terug", remindAfterDays: 3, endsOn: "2026-11-20" },
    );
    await repo.dismissAnnouncement(w.anna, a!.id, TODAY);
    const on = async (day: string) =>
      (await repo.announcementsFor(w.anna, day)).map((x) => x.message);
    expect(await on("2026-11-13")).not.toContain("terug");
    expect(await on("2026-11-14")).toContain("terug");
    // Dismissed again: away for another three days.
    await repo.dismissAnnouncement(w.anna, a!.id, "2026-11-14");
    expect(await on("2026-11-16")).not.toContain("terug");
    expect(await on("2026-11-17")).toContain("terug");
    expect(await on("2026-11-21")).not.toContain("terug");
  });

  it("does not dismiss an announcement the user cannot see", async () => {
    const w = await world();
    const a = await post(w.admin, { kind: "user", userId: w.bram });
    expect(await repo.dismissAnnouncement(w.anna, a!.id, TODAY)).toBe(false);
    expect(await repo.dismissAnnouncement(w.anna, "nope", TODAY)).toBe(false);
  });

  it("lists every announcement for the admin with who it is for, newest first", async () => {
    const w = await world();
    await post(w.admin, { kind: "team", teamId: w.team }, { message: `lijst team ${n}` });
    await post(w.admin, { kind: "user", userId: w.anna }, { message: `lijst anna ${n}` });
    const list = await repo.listAnnouncements();
    const anna = list.find((a) => a.message === `lijst anna ${n}`);
    const team = list.find((a) => a.message === `lijst team ${n}`);
    expect(anna?.audience).toEqual({ kind: "user", id: w.anna, name: `anna ${n}` });
    expect(team?.audience).toEqual({ kind: "team", id: w.team, name: `Team ${n}` });
    expect(list.indexOf(anna!)).toBeLessThan(list.indexOf(team!));
  });

  it("removes an announcement with its dismissals", async () => {
    const w = await world();
    const a = await post(w.admin, { kind: "all" }, { message: `weghalen ${n}` });
    await repo.dismissAnnouncement(w.anna, a!.id, TODAY);
    expect(await repo.removeAnnouncement(a!.id)).toBe(true);
    expect(await shownTo(w.bram)).not.toContain(`weghalen ${n}`);
    expect((await repo.listAnnouncements()).some((x) => x.id === a!.id)).toBe(false);
    expect(await repo.removeAnnouncement(a!.id)).toBe(false);
  });

  it("goes with a deleted team or account", async () => {
    const w = await world();
    await post(w.admin, { kind: "team", teamId: w.team }, { message: `team weg ${n}` });
    await post(w.admin, { kind: "user", userId: w.bram }, { message: `bram weg ${n}` });
    await teams.deleteTeam(w.team);
    await users.deleteUserCascade(w.bram);
    const messages = (await repo.listAnnouncements()).map((a) => a.message);
    expect(messages).not.toContain(`team weg ${n}`);
    expect(messages).not.toContain(`bram weg ${n}`);
  });
});
