import { describe, it, expect, beforeAll } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { sampleRubric } from "../utilities/fixtures";
import { flatRoutes } from "../helpers/routes";

process.env.DATABASE_URL = "file::memory:";

let route: typeof import("~/routes/assessment-models");
let repo: typeof import("~/server/repositories/assessmentModels.server");
let rubrics: typeof import("~/server/repositories/rubrics.server");

beforeAll(async () => {
  route = await import("~/routes/assessment-models");
  repo = await import("~/server/repositories/assessmentModels.server");
  rubrics = await import("~/server/repositories/rubrics.server");
});

function post(fields: Record<string, string | string[]>, cookie = ""): Request {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields))
    for (const one of Array.isArray(v) ? v : [v]) body.append(k, one);
  return signedRequest("http://localhost/assessment-models", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie },
    body: body.toString(),
  });
}
const act = (fields: Record<string, string | string[]>, cookie = "") =>
  route.action({ request: post(fields, cookie) } as never);
const load = () =>
  route.loader({ request: signedRequest("http://localhost/assessment-models") } as never);
const as = (id: string) => signInAs({ id });

describe("/assessment-models", () => {
  it("is a page in the app shell", () => {
    expect(flatRoutes()).toContainEqual({
      path: "/assessment-models",
      file: "routes/assessment-models.tsx",
      inShell: true,
    });
  });

  it("creates a model with its document types, framework and an optional scale", async () => {
    await as("am-create");
    const res = await act({
      intent: "create",
      name: " Essay jaar 1 ",
      documentTypes: ["essay", "verslag"],
      framework: "C1 Stelling",
      scale: "",
    });
    expect(res).toEqual({ ok: true, intent: "create" });
    const [m] = await repo.listAssessmentModels("am-create");
    expect(m).toMatchObject({
      name: "Essay jaar 1",
      data: { documentTypes: ["essay", "verslag"], framework: "C1 Stelling", scale: "" },
    });
  });

  it("refuses a model without a name or framework, or with an unknown document type", async () => {
    await as("am-bad");
    expect(await act({ intent: "create", name: "", framework: "C1" })).toEqual({
      ok: false,
      error: "name",
    });
    expect(await act({ intent: "create", name: "X", framework: "  " })).toEqual({
      ok: false,
      error: "framework",
    });
    expect(
      await act({ intent: "create", name: "X", framework: "C1", documentTypes: "nope" }),
    ).toEqual({ ok: false, error: "documentType" });
    expect(await repo.listAssessmentModels("am-bad")).toEqual([]);
  });

  it("updates and deletes only the teacher's own model", async () => {
    const theirs = await repo.createAssessmentModel("am-owner", "Privé", {
      documentTypes: [],
      framework: "C1",
      scale: "",
    });
    await as("am-intruder");
    expect(
      await act({ intent: "update", id: theirs.id, name: "Gekaapt", framework: "C9" }),
    ).toEqual({ ok: false, error: "notFound" });
    expect(await act({ intent: "delete", id: theirs.id })).toEqual({
      ok: false,
      error: "notFound",
    });
    expect((await repo.getAssessmentModel("am-owner", theirs.id))?.name).toBe("Privé");

    await as("am-owner");
    expect(
      await act({ intent: "update", id: theirs.id, name: "Mijn model", framework: "C2" }),
    ).toEqual({ ok: true, intent: "update" });
    expect((await repo.getAssessmentModel("am-owner", theirs.id))?.data.framework).toBe("C2");
    expect(await act({ intent: "delete", id: theirs.id })).toEqual({ ok: true, intent: "delete" });
    expect(await repo.listAssessmentModels("am-owner")).toEqual([]);
  });

  it("copies a starter into the teacher's own models, in their language", async () => {
    await as("am-starter");
    expect(await act({ intent: "copy-starter", starter: "essay" }, "lang=en")).toEqual({
      ok: true,
      intent: "copy-starter",
    });
    const [m] = await repo.listAssessmentModels("am-starter");
    expect(m?.name).toBe("Essay (general)");
    expect(m?.data.documentTypes).toEqual(["essay"]);
    expect(m?.data.framework).toMatch(/Thesis or central question/);
    expect(await act({ intent: "copy-starter", starter: "nope" })).toEqual({
      ok: false,
      error: "notFound",
    });
  });

  it("turns an own rubric into a model, never someone else's", async () => {
    const mine = await rubrics.createRubric("am-rubric", "Betoog", sampleRubric());
    const theirs = await rubrics.createRubric("am-other", "Ander", sampleRubric());
    await as("am-rubric");
    expect(await act({ intent: "from-rubric", rubric: theirs.id })).toEqual({
      ok: false,
      error: "notFound",
    });
    expect(await act({ intent: "from-rubric", rubric: mine.id })).toEqual({
      ok: true,
      intent: "from-rubric",
    });
    const [m] = await repo.listAssessmentModels("am-rubric");
    expect(m?.name).toBe("Betoog");
    expect(m?.data.framework).toMatch(/Analyse/);
    expect(m?.data.framework).toMatch(/Bronnen/);
  });

  it("lists own models, the starters, own rubrics and the document types to choose from", async () => {
    await repo.createAssessmentModel("am-list", "Mijn model", {
      documentTypes: ["essay"],
      framework: "C1",
      scale: "",
    });
    await rubrics.createRubric("am-list", "Mijn rubric", sampleRubric());
    await as("am-list");
    const data = (await load()) as {
      models: { name: string }[];
      starters: { id: string }[];
      rubrics: { name: string }[];
      documentTypes: { value: string }[];
    };
    expect(data.models.map((m) => m.name)).toEqual(["Mijn model"]);
    expect(data.starters.map((s) => s.id)).toContain("hbo-i-stage");
    expect(data.rubrics.map((r) => r.name)).toEqual(["Mijn rubric"]);
    expect(data.documentTypes.map((d) => d.value)).toEqual(
      expect.arrayContaining(["essay", "stageverslag", "afstudeerscriptie"]),
    );
  });
});
