import { describe, it, expect, beforeAll } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";

process.env.DATABASE_URL = "file::memory:";

let toolRoute: typeof import("~/routes/tool");
let repo: typeof import("~/server/repositories/assessmentModels.server");

beforeAll(async () => {
  toolRoute = await import("~/routes/tool");
  repo = await import("~/server/repositories/assessmentModels.server");
});

type Loaded = { assessmentModels: { id: string; name: string; starter: boolean }[] };
const load = (slug: string, cookie = "") =>
  toolRoute.loader({
    request: signedRequest(`http://localhost/tools/${slug}`, { headers: { cookie } }),
    params: { slug },
    context: {},
  } as never) as Promise<Loaded>;

describe("tool loader — assessment models", () => {
  it("offers the teacher's own models first, then the starters in their language", async () => {
    await repo.createAssessmentModel("tam-own", "Mijn essaymodel", {
      documentTypes: ["essay"],
      framework: "C1",
      scale: "",
    });
    await repo.createAssessmentModel("tam-other", "Van een ander", {
      documentTypes: ["essay"],
      framework: "C1",
      scale: "",
    });
    await signInAs({ id: "tam-own" });
    const data = await load("stage-assessment", "lang=en");
    expect(data.assessmentModels[0]).toMatchObject({
      name: "Mijn essaymodel",
      documentTypes: ["essay"],
      starter: false,
    });
    expect(data.assessmentModels.map((m) => m.name)).not.toContain("Van een ander");
    const starter = data.assessmentModels.find((m) => m.id === "starter:essay");
    expect(starter).toMatchObject({ name: "Essay (general)", starter: true });
  });

  it("offers none to a tool without assessment models", async () => {
    await signInAs({ id: "tam-other-tool" });
    expect((await load("mentorai")).assessmentModels).toEqual([]);
  });
});
