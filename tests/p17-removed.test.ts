import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PROMPTS } from "~/lib/prompts";
import { en } from "~/lib/i18n/messages/en";
import { nl } from "~/lib/i18n/messages/nl";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("P17.1 — mentor insight removed", () => {
  it("routes.ts registers no api/session-close and no cohort insight page", () => {
    const routes = read("app/routes.ts");
    expect(routes).not.toContain("api/session-close");
    expect(routes).not.toContain("/insight");
  });

  it("the mentor-insight modules are gone", () => {
    for (const p of [
      "app/routes/api.session-close.tsx",
      "app/routes/cohorts.$id.insight.tsx",
      "app/server/repositories/insight.server.ts",
      "app/server/insight",
      "app/lib/insight",
      "app/server/repositories/chat.server.ts",
      "app/components/SessionHelpfulness.tsx",
    ]) {
      expect(existsSync(resolve(root, p)), p).toBe(false);
    }
  });

  it("the session-summary prompt is not registered", () => {
    expect(PROMPTS["session-summary@v1"]).toBeUndefined();
  });

  it("package.json has no sweep or eval:summary script", () => {
    const scripts = JSON.parse(read("package.json")).scripts as Record<string, string>;
    expect(scripts).not.toHaveProperty("sweep");
    expect(scripts).not.toHaveProperty("eval:summary");
  });

  it("the i18n catalogues have no insight or helpfulness namespace", () => {
    for (const cat of [nl, en]) {
      expect("insight" in cat).toBe(false);
      expect("helpfulness" in cat).toBe(false);
    }
  });
});

describe("P17.2 — student role and cohorts removed", () => {
  it("routes.ts registers no cohort routes", () => {
    expect(read("app/routes.ts")).not.toContain("cohorts");
  });

  it("the cohort modules are gone", () => {
    for (const p of [
      "app/server/repositories/cohorts.server.ts",
      "app/routes/cohorts._index.tsx",
      "app/routes/cohorts.$id.tsx",
      "app/routes/admin.cohorts.tsx",
    ]) {
      expect(existsSync(resolve(root, p)), p).toBe(false);
    }
  });

  it("the i18n catalogues have no cohorts namespace", () => {
    for (const cat of [nl, en]) {
      expect("cohorts" in cat).toBe(false);
      expect("cohorts" in (cat as { admin: object }).admin).toBe(false);
    }
  });
});
