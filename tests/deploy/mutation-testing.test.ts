import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Mutation testing (Stryker) on the core: the registry, auth, the repositories, the rate limiter
 * and the login throttle. It runs nightly in its own workflow, never on a pull request, because a
 * full run takes far longer than the gate.
 */
const root = resolve(__dirname, "../..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

const config = JSON.parse(read("stryker.config.json")) as {
  testRunner: string;
  coverageAnalysis: string;
  mutate: string[];
  vitest?: { configFile?: string };
  reporters: string[];
};
const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
const workflow = read(".github/workflows/mutation.yml");

const includes = config.mutate.filter((g) => !g.startsWith("!"));
const excludes = config.mutate.filter((g) => g.startsWith("!")).map((g) => g.slice(1));
const mutated = new Set(
  globSync(includes, { cwd: root, exclude: excludes }).map((f) => f.replaceAll("\\", "/")),
);

describe("Stryker config", () => {
  it("runs the vitest suite with per-test coverage, so each mutant only runs the tests that reach it", () => {
    expect(config.testRunner).toBe("vitest");
    expect(config.coverageAnalysis).toBe("perTest");
    expect(config.vitest?.configFile).toBe("vitest.config.ts");
  });

  it.each([
    "app/lib/registry/validate.ts",
    "app/lib/registry/modes.ts",
    "app/lib/registry/access.ts",
    "app/server/auth.server.ts",
    "app/server/session.server.ts",
    "app/server/password.server.ts",
    "app/server/repositories/users.server.ts",
    "app/server/repositories/shares.server.ts",
    "app/server/rateLimit.server.ts",
    "app/server/loginThrottle.server.ts",
  ])("mutates the core file %s", (file) => {
    expect(mutated).toContain(file);
  });

  it.each(["app/lib/registry/tools/", "app/lib/registry/goals.ts", "app/lib/registry/keywords.ts"])(
    "does not mutate registry data (%s), only the registry's logic",
    (data) => {
      expect([...mutated].filter((f) => f.startsWith(data))).toEqual([]);
    },
  );

  it("every mutate pattern still matches a file (a moved module must not drop out silently)", () => {
    for (const glob of includes) {
      expect(globSync(glob, { cwd: root }), glob).not.toEqual([]);
    }
  });

  it("writes an HTML report for the nightly artifact", () => {
    expect(config.reporters).toContain("html");
  });

  it("starts with `npm run test:mutation`", () => {
    expect(pkg.scripts["test:mutation"]).toBe("stryker run");
  });
});

describe("nightly mutation workflow", () => {
  it("runs on a schedule and by hand, never on a push or a pull request", () => {
    expect(workflow).toMatch(/^\s+schedule:\s*\n\s+- cron: "[^"]+"/m);
    expect(workflow).toMatch(/^\s+workflow_dispatch:/m);
    expect(workflow).not.toMatch(/^\s+(pull_request|push):/m);
  });

  it("uses the pinned Node version and runs the mutation script", () => {
    expect(workflow).toContain('node-version: "24.14.1"');
    expect(workflow).toContain("run: npm run test:mutation");
  });

  it("keeps the HTML report as an artifact, also when the run fails", () => {
    expect(workflow).toMatch(/uses: actions\/upload-artifact@v4\s*\n\s+if: always\(\)/);
    expect(workflow).toContain("path: reports/mutation/");
  });
});
