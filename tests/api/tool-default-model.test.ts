import { beforeAll, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";

process.env.DATABASE_URL = "file::memory:";

let toolRoute: typeof import("~/routes/tool");
let users: typeof import("~/server/repositories/users.server");
let availability: typeof import("~/server/availability.server");
let DEFAULT_MODEL: string;

beforeAll(async () => {
  toolRoute = await import("~/routes/tool");
  users = await import("~/server/repositories/users.server");
  availability = await import("~/server/availability.server");
  ({ DEFAULT_MODEL } = await import("~/lib/ai/models"));
});

type Loaded = { tool: { defaultModel: string } };
const load = (slug: string) =>
  toolRoute.loader({
    request: signedRequest(`http://localhost/tools/${slug}`),
    params: { slug },
    context: {},
  } as never) as Promise<Loaded>;

describe("tool loader — the picker starts on the person's default model", () => {
  it("hands the client the layered default, not the config default", async () => {
    const own = [...(await availability.getSelectableModelIds())].find(
      (id) => id !== DEFAULT_MODEL,
    )!;
    await signInAs({ id: "tdm-teacher" });
    await users.setUserDefaultModel("tdm-teacher", own);
    expect((await load("mentorai")).tool.defaultModel).toBe(own);
    await users.setUserDefaultModel("tdm-teacher", null);
    expect((await load("mentorai")).tool.defaultModel).toBe(DEFAULT_MODEL);
  });
});
