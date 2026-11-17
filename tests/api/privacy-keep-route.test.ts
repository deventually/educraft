import { beforeAll, describe, expect, it } from "vitest";
import { signIn } from "../helpers/session";
import { flatRoutes } from "../helpers/routes";

type ActionMod = typeof import("~/routes/api.privacy.keep");

let action: ActionMod["action"];
let repo: typeof import("~/server/repositories/keepWords.server");

beforeAll(async () => {
  ({ action } = await import("~/routes/api.privacy.keep"));
  repo = await import("~/server/repositories/keepWords.server");
});

async function post(body: unknown, userId?: string): Promise<Response> {
  const request = new Request("http://localhost/api/privacy/keep", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { cookie: await signIn({ id: userId }) } : {}),
    },
    body: JSON.stringify(body),
  });
  return action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);
}

/** The never-list from the live preview (anonymiseerpoort PR 3): always the caller's own. */
describe("api.privacy.keep", () => {
  it("is a route", () => {
    expect(flatRoutes().map((r) => r.path)).toContain("/api/privacy/keep");
  });

  it("adds and removes a word on the signed-in teacher's own list", async () => {
    expect((await post({ intent: "add", word: "Visser" }, "pk-a")).status).toBe(200);
    expect(await repo.listKeepWords("pk-a")).toEqual(["Visser"]);
    expect((await post({ intent: "remove", word: "Visser" }, "pk-a")).status).toBe(200);
    expect(await repo.listKeepWords("pk-a")).toEqual([]);
  });

  it("refuses personal data, an unknown intent and a malformed body", async () => {
    expect((await post({ intent: "add", word: "jan@school.nl" }, "pk-b")).status).toBe(400);
    expect((await post({ intent: "other", word: "Visser" }, "pk-b")).status).toBe(400);
    expect((await post({ intent: "add", word: "x".repeat(201) }, "pk-b")).status).toBe(400);
    expect(await repo.listKeepWords("pk-b")).toEqual([]);
  });

  it("refuses an anonymous caller", async () => {
    const res = await post({ intent: "add", word: "Visser" }).catch((r: Response) => r);
    expect(res.status).not.toBe(200);
  });
});
