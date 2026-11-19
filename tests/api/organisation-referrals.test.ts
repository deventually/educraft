import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let users: typeof import("~/server/repositories/users.server");
let page: typeof import("~/routes/admin.organisation");

beforeAll(async () => {
  users = await import("~/server/repositories/users.server");
  page = await import("~/routes/admin.organisation");
});

let n = 0;
async function mk(role: "teacher" | "admin") {
  n++;
  const u = await users.createUser({
    name: `R ${n}`,
    email: `r${n}@school.nl`,
    passwordHash: "scrypt:a:b",
    role,
  });
  return u.id;
}

const post = (fields: Record<string, string>) =>
  signedRequest("http://localhost/admin/organisation", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
const get = () => signedRequest("http://localhost/admin/organisation");
const call = <F extends (a: never) => unknown>(fn: F, args: object) =>
  fn({ params: {}, context: {}, ...args } as never) as Promise<Awaited<ReturnType<F>>>;

let admin: string;
beforeEach(async () => {
  admin ??= await mk("admin");
  await signInAs({ id: admin });
});

/** P39.4: the admin fills in the referral guide on Beheer → Organisatie. */
describe("/admin/organisation, the referral guide", () => {
  it("starts empty", async () => {
    expect((await call(page.loader, { request: get() })).referralGuide).toEqual([]);
  });

  it("saves the guide and shows it again", async () => {
    const res = await call(page.action, {
      request: post({
        intent: "referrals",
        "counter-mental-health": "Studentpsycholoog",
        "description-mental-health": "Voor psychische klachten.",
        "link-mental-health": "https://school.nl/psycholoog",
      }),
    });
    expect(res).toEqual({ ok: "referrals" });
    expect((await call(page.loader, { request: get() })).referralGuide).toEqual([
      {
        kind: "mental-health",
        counter: "Studentpsycholoog",
        description: "Voor psychische klachten.",
        link: "https://school.nl/psycholoog",
      },
    ]);
  });

  it("refuses an unsafe link and keeps what was saved", async () => {
    const before = (await call(page.loader, { request: get() })).referralGuide;
    const res = await call(page.action, {
      request: post({
        intent: "referrals",
        "counter-money": "Decaan",
        "link-money": "javascript:x",
      }),
    });
    expect(res).toEqual({ error: "referral", kind: "money" });
    expect((await call(page.loader, { request: get() })).referralGuide).toEqual(before);
  });

  it("a teacher cannot save it", async () => {
    await signInAs({ id: await mk("teacher") });
    let refused = false;
    try {
      await call(page.action, { request: post({ intent: "referrals", "counter-money": "X" }) });
    } catch (e) {
      refused = e instanceof Response;
    }
    expect(refused).toBe(true);
  });

  it("emptying every counter clears the guide", async () => {
    expect(await call(page.action, { request: post({ intent: "referrals" }) })).toEqual({
      ok: "referrals",
    });
    expect((await call(page.loader, { request: get() })).referralGuide).toEqual([]);
  });
});

/** P39.4: the guide reaches the SLB help topic and "Een gesprek voorbereiden", read-only. */
describe("where a teacher reads the referral guide", () => {
  const guide = [{ kind: "money", counter: "Studentendecaan", description: "", link: "" }];

  it("in the SLB help topic, and not in another topic", async () => {
    const repo = await import("~/server/repositories/referralGuide.server");
    const help = await import("~/routes/help.$id");
    await repo.setReferralGuide(guide as never);
    await signInAs({ id: await mk("teacher") });
    const load = (id: string) =>
      help.loader({
        request: signedRequest(`http://localhost/help/${id}`),
        params: { id },
        context: {},
      } as never) as Promise<{ referralGuide?: unknown }>;
    expect((await load("slb")).referralGuide).toEqual(guide);
    expect((await load("courses")).referralGuide).toBeNull();
  });

  it("under the result of Een gesprek voorbereiden, and not of another tool", async () => {
    const repo = await import("~/server/repositories/referralGuide.server");
    const tool = await import("~/routes/tool");
    await repo.setReferralGuide(guide as never);
    await signInAs({ id: await mk("teacher") });
    const load = (slug: string) =>
      tool.loader({
        request: signedRequest(`http://localhost/tools/${slug}`),
        params: { slug },
        context: {},
      } as never) as Promise<{ referralGuide: unknown }>;
    expect((await load("conversation-prep")).referralGuide).toEqual(guide);
    expect((await load("authentic-assessment")).referralGuide).toBeNull();
  });
});
