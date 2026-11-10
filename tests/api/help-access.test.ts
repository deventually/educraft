import { beforeAll, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let exceptions: typeof import("~/server/repositories/exceptions.server");
let index: typeof import("~/routes/help._index");
let page: typeof import("~/routes/help.$id");

beforeAll(async () => {
  exceptions = await import("~/server/repositories/exceptions.server");
  index = await import("~/routes/help._index");
  page = await import("~/routes/help.$id");
});

const get = () => signedRequest("http://localhost/help");
const slugsOn = async () =>
  (await index.loader({ request: get() } as never)).sections.flatMap((s) =>
    s.topics.map((t) => t.slug),
  );
async function status(id: string): Promise<number> {
  try {
    await page.loader({ request: get(), params: { id } } as never);
    return 200;
  } catch (e) {
    return e instanceof Response ? e.status : -1;
  }
}

describe("help follows what a teacher may use", () => {
  it("hides the BDB and BKE from a teacher without the workplace, list and page", async () => {
    await signInAs({ id: "h-off" });
    expect(await slugsOn()).not.toContain("bdb-bke");
    expect(await status("bdb-bke")).toBe(404);
  });

  it("shows the BDB and BKE once the workplace is on for that teacher", async () => {
    await signInAs({ id: "h-on" });
    await exceptions.setException("h-on", exceptions.featureKey("portfolio"), "on");
    expect(await slugsOn()).toContain("bdb-bke");
    expect(await status("bdb-bke")).toBe(200);
  });

  it("keeps the admin topic for admins", async () => {
    await signInAs({ id: "h-teacher" });
    expect(await slugsOn()).not.toContain("admin");
    expect(await status("admin")).toBe(404);
    await signInAs({ id: "h-admin", role: "admin" });
    expect(await slugsOn()).toContain("admin");
    expect(await status("admin")).toBe(200);
  });
});
