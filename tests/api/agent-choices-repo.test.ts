// @vitest-environment node
// A teacher's own choice of role agents ("hats"): which hats look at their courses. Owner-scoped
// like every repository; an unknown hat id is never stored or returned.
import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file::memory:";

let repo: typeof import("~/server/repositories/agentChoices.server");
let users: typeof import("~/server/repositories/users.server");

beforeAll(async () => {
  repo = await import("~/server/repositories/agentChoices.server");
  users = await import("~/server/repositories/users.server");
});

describe("agent choices repository", () => {
  it("is empty until the teacher chooses", async () => {
    expect(await repo.getAgentChoices("choices-a")).toEqual({});
  });

  it("stores a choice per hat and replaces it on a second save", async () => {
    await repo.setAgentChoices("choices-b", { designer: "off", "assessment-expert": "on" });
    expect(await repo.getAgentChoices("choices-b")).toEqual({
      designer: "off",
      "assessment-expert": "on",
    });
    await repo.setAgentChoices("choices-b", { designer: "on" });
    expect(await repo.getAgentChoices("choices-b")).toEqual({
      designer: "on",
      "assessment-expert": "on",
    });
  });

  it("never shows one teacher's choice to another", async () => {
    await repo.setAgentChoices("choices-c", { designer: "off" });
    expect(await repo.getAgentChoices("choices-d")).toEqual({});
  });

  it("drops a hat that does not exist", async () => {
    await repo.setAgentChoices("choices-e", { "made-up": "on", designer: "off" });
    expect(await repo.getAgentChoices("choices-e")).toEqual({ designer: "off" });
  });

  it("is removed with the teacher's data", async () => {
    await repo.setAgentChoices("choices-f", { designer: "off" });
    await users.deleteUserCascade("choices-f");
    expect(await repo.getAgentChoices("choices-f")).toEqual({});
  });
});
