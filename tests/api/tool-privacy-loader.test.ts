import { beforeAll, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";

type ToolRoute = typeof import("~/routes/tool");
let toolRoute: ToolRoute;

beforeAll(async () => {
  toolRoute = await import("~/routes/tool");
  const users = await import("~/server/repositories/users.server");
  const teams = await import("~/server/repositories/teams.server");
  const keep = await import("~/server/repositories/keepWords.server");
  await signInAs({ id: "tp-a", name: "Mark de Groot" });
  await users.createUser({ id: "tp-b", name: "Anna Visser", passwordHash: "x", role: "teacher" });
  const team = await teams.createTeam("Team TP");
  await teams.addMember(team.id, "tp-a");
  await teams.addMember(team.id, "tp-b");
  await keep.addKeepWord("tp-a", "Kolb");
});

/**
 * What the gate knows, the page knows too (anonymiseerpoort PR 3): the live preview gets the
 * same names, so it shows exactly what the gate will do, and the teacher's never-list.
 */
describe("tool loader — the live preview's names", () => {
  it("gives the page the teacher, the colleagues and the never-list", async () => {
    const data = await toolRoute.loader({
      request: signedRequest("http://localhost/tools/engagement-check"),
      params: { slug: "engagement-check" },
      context: {},
    } as unknown as Parameters<ToolRoute["loader"]>[0]);
    expect(data.privacy).toEqual({
      known: { teacher: "Mark de Groot", colleagues: ["Anna Visser"] },
      never: ["Kolb"],
      shared: [],
    });
  });
});
