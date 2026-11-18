// The institution's never-words (/admin/privacy, anonymiseerpoort PR 5): the admin sees which
// words teachers keep, never whose, and keeps one for everyone with one click.
import { beforeAll, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";

process.env.DATABASE_URL = "file::memory:";

let route: typeof import("~/routes/admin.privacy");
let shared: typeof import("~/server/repositories/sharedKeepWords.server");

beforeAll(async () => {
  route = await import("~/routes/admin.privacy");
  shared = await import("~/server/repositories/sharedKeepWords.server");
  const users = await import("~/server/repositories/users.server");
  const keep = await import("~/server/repositories/keepWords.server");
  await users.createUser({ id: "ap-t1", name: "Lies Kok", passwordHash: "x", role: "teacher" });
  await users.createUser({ id: "ap-t2", name: "Tom Bakker", passwordHash: "x", role: "teacher" });
  await keep.addKeepWord("ap-t1", "Engelmann");
  await keep.addKeepWord("ap-t2", "Engelmann");
  await keep.addKeepWord("ap-t2", "Lies Kok");
  await signInAs({ id: "ap-admin", role: "admin" });
});

function post(fields: Record<string, string>) {
  const request = signedRequest("http://localhost/admin/privacy", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
  return route.action({ request, params: {}, context: {} } as never) as Promise<unknown>;
}

const load = () =>
  route.loader({
    request: signedRequest("http://localhost/admin/privacy"),
    params: {},
    context: {},
  } as never) as Promise<{ suggestions: { word: string; teachers: number }[]; shared: string[] }>;

describe("admin.privacy", () => {
  it("lists the teachers' words with a count, without a user's name", async () => {
    expect(await load()).toEqual({ suggestions: [{ word: "Engelmann", teachers: 2 }], shared: [] });
  });

  it("keeps a word for everyone, and takes it off again", async () => {
    expect(await post({ intent: "share", word: "Engelmann" })).toEqual({
      ok: true,
      intent: "share",
      word: "Engelmann",
    });
    expect(await load()).toEqual({ suggestions: [], shared: ["Engelmann"] });
    expect(await post({ intent: "unshare", word: "Engelmann" })).toEqual({
      ok: true,
      intent: "unshare",
      word: "Engelmann",
    });
    expect(await shared.listSharedKeepWords()).toEqual([]);
  });

  it("refuses a user's name, what is not a word and an unknown intent", async () => {
    expect(await post({ intent: "share", word: "Tom Bakker" })).toEqual({
      ok: false,
      error: "name",
    });
    expect(await post({ intent: "share", word: "jan@school.nl" })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(await post({ intent: "nope", word: "Engelmann" })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(await shared.listSharedKeepWords()).toEqual([]);
  });
});
