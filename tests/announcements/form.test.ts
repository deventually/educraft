import { describe, expect, it } from "vitest";
import { ANNOUNCEMENT_MAX, parseAnnouncementForm } from "~/lib/announcements";

const TODAY = "2026-11-11";
const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};
const base = {
  message: "Onderhoud",
  level: "info",
  audience: "all",
  endsOn: "",
  remindAfterDays: "",
};

describe("parseAnnouncementForm", () => {
  it("reads an announcement for everyone without a last day", () => {
    expect(parseAnnouncementForm(form(base), TODAY)).toEqual({
      ok: true,
      value: {
        message: "Onderhoud",
        level: "info",
        audience: { kind: "all" },
        endsOn: null,
        remindAfterDays: null,
      },
    });
  });

  it("reads a team or a person as the audience, with a last day", () => {
    const team = parseAnnouncementForm(
      form({ ...base, level: "warning", audience: "team", teamId: "t1", endsOn: TODAY }),
      TODAY,
    );
    expect(team).toMatchObject({
      ok: true,
      value: { level: "warning", audience: { kind: "team", teamId: "t1" }, endsOn: TODAY },
    });
    const person = parseAnnouncementForm(form({ ...base, audience: "user", userId: "u1" }), TODAY);
    expect(person).toMatchObject({ ok: true, value: { audience: { kind: "user", userId: "u1" } } });
  });

  it("trims the text and refuses an empty or too long one", () => {
    expect(parseAnnouncementForm(form({ ...base, message: "  hoi  " }), TODAY)).toMatchObject({
      value: { message: "hoi" },
    });
    expect(parseAnnouncementForm(form({ ...base, message: "   " }), TODAY)).toEqual({
      ok: false,
      error: "messageRequired",
    });
    expect(
      parseAnnouncementForm(form({ ...base, message: "x".repeat(ANNOUNCEMENT_MAX + 1) }), TODAY),
    ).toEqual({ ok: false, error: "invalid" });
  });

  it("asks for the team or person when that audience is chosen", () => {
    expect(parseAnnouncementForm(form({ ...base, audience: "team" }), TODAY)).toEqual({
      ok: false,
      error: "teamRequired",
    });
    expect(parseAnnouncementForm(form({ ...base, audience: "user" }), TODAY)).toEqual({
      ok: false,
      error: "userRequired",
    });
  });

  it("reads how many days a dismissed announcement stays away, 1 to 30", () => {
    expect(parseAnnouncementForm(form({ ...base, remindAfterDays: "7" }), TODAY)).toMatchObject({
      ok: true,
      value: { remindAfterDays: 7 },
    });
    for (const bad of ["0", "31", "2.5", "abc"])
      expect(parseAnnouncementForm(form({ ...base, remindAfterDays: bad }), TODAY)).toEqual({
        ok: false,
        error: "invalid",
      });
  });

  it("refuses a last day in the past, an unknown level and a bad date", () => {
    expect(parseAnnouncementForm(form({ ...base, endsOn: "2026-11-10" }), TODAY)).toEqual({
      ok: false,
      error: "endsInPast",
    });
    expect(parseAnnouncementForm(form({ ...base, level: "danger" }), TODAY)).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(parseAnnouncementForm(form({ ...base, endsOn: "2026-02-30" }), TODAY)).toEqual({
      ok: false,
      error: "invalid",
    });
  });
});
