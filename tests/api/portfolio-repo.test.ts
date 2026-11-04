import { beforeAll, describe, expect, it } from "vitest";
import { sampleDossier } from "../portfolio/fixtures";

process.env.DATABASE_URL = "file::memory:";

type Repo = typeof import("~/server/repositories/portfolio.server");
let repo: Repo;
let users: typeof import("~/server/repositories/users.server");

const A = "portfolio-user-a";
const B = "portfolio-user-b";

beforeAll(async () => {
  repo = await import("~/server/repositories/portfolio.server");
  users = await import("~/server/repositories/users.server");
});

describe("portfolio repository", () => {
  it("round-trips create, get, update and delete", async () => {
    const created = await repo.createDossier(A, "BDB 2026", sampleDossier());
    expect(created.name).toBe("BDB 2026");
    const got = await repo.getDossier(A, created.id);
    expect(got?.data.framework.institution).toBe("Hogeschool X");

    const next = { ...sampleDossier(), coachMode: "draft" as const };
    const updated = await repo.updateDossier(A, created.id, { name: "BDB nov", data: next });
    expect(updated?.name).toBe("BDB nov");
    expect((await repo.getDossier(A, created.id))?.data.coachMode).toBe("draft");

    expect(await repo.deleteDossier(A, created.id)).toBe(true);
    expect(await repo.getDossier(A, created.id)).toBeNull();
  });

  it("scopes every call to the owner", async () => {
    const mine = await repo.createDossier(A, "Van A", sampleDossier());
    expect(await repo.getDossier(B, mine.id)).toBeNull();
    expect(await repo.updateDossier(B, mine.id, { name: "gekaapt" })).toBeNull();
    expect(await repo.deleteDossier(B, mine.id)).toBe(false);
    expect((await repo.listDossiers(B)).map((d) => d.id)).not.toContain(mine.id);
    expect((await repo.getDossier(A, mine.id))?.name).toBe("Van A");
  });

  it("refuses invalid data and writes nothing", async () => {
    const d = await repo.createDossier(A, "Geldig", sampleDossier());
    const bad = sampleDossier();
    bad.evidence[0].criterionIds = ["onbekend"];
    await expect(repo.updateDossier(A, d.id, { data: bad })).rejects.toThrow();
    await expect(repo.createDossier(A, "Fout", bad)).rejects.toThrow();
    expect((await repo.getDossier(A, d.id))?.data.evidence[0].criterionIds).toHaveLength(1);
    await expect(repo.createDossier(A, "", sampleDossier())).rejects.toThrow();
    await expect(repo.createDossier(A, "x".repeat(201), sampleDossier())).rejects.toThrow();
  });

  it("caps the list and orders newest first", async () => {
    const list = await repo.listDossiers(A, 1);
    expect(list).toHaveLength(1);
    const all = await repo.listDossiers(A);
    const times = all.map((d) => d.updatedAt.getTime());
    expect([...times].sort((x, y) => y - x)).toEqual(times);
  });

  it("is removed by deleteUserCascade", async () => {
    const d = await repo.createDossier(B, "Weg", sampleDossier());
    await users.deleteUserCascade(B);
    expect(await repo.getDossier(B, d.id)).toBeNull();
  });
});
