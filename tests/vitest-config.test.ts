import { describe, expect, it } from "vitest";
import config from "../vitest.config";

/**
 * The test setup (`tests/setup.ts`) loads jest-dom and React Testing Library. Only the happy-dom
 * project renders components; loading that setup for the ~280 node test files cost ~40 s of
 * setup time per run without any test using it.
 */
type Project = { test?: { environment?: string; setupFiles?: string | string[] } };
const projects = (config.test?.projects ?? []) as Project[];
const byEnvironment = (env: string) => projects.find((p) => p.test?.environment === env)?.test;
const setupFiles = (env: string) => [byEnvironment(env)?.setupFiles ?? []].flat();

describe("vitest config", () => {
  it("has a node project and a happy-dom project", () => {
    expect(byEnvironment("node")).toBeDefined();
    expect(byEnvironment("happy-dom")).toBeDefined();
  });

  it("loads the DOM test setup only for the happy-dom project", () => {
    expect(setupFiles("happy-dom")).toContain("tests/setup.ts");
    expect(setupFiles("node")).not.toContain("tests/setup.ts");
  });
});
