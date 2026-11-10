import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Security scanning runs on GitHub itself, no outside service: npm audit in CI, CodeQL on the
 * code, Dependabot for updates. Read as text: the workflows are small and a YAML parser would be
 * a new dependency for one test.
 */
const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("security scan", () => {
  // Production dependencies must be clean from moderate up. The whole tree (dev tools too) blocks
  // only from high, so known moderate findings in dev tooling don't turn CI red.
  it("CI audits production dependencies from moderate and the whole tree from high", () => {
    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain("npm audit --omit=dev --audit-level=moderate");
    expect(ci).toContain("npm audit --audit-level=high");
  });

  it("CodeQL scans the JavaScript and TypeScript on every pull request and on main", () => {
    const codeql = read(".github/workflows/codeql.yml");
    expect(codeql).toContain("github/codeql-action/analyze");
    expect(codeql).toMatch(/languages:\s*javascript-typescript/);
    expect(codeql).toMatch(/pull_request:/);
    expect(codeql).toMatch(/branches:\s*\[main\]/);
  });

  it("Dependabot updates npm and GitHub Actions weekly, small updates grouped, majors apart", () => {
    expect(existsSync(resolve(root, "renovate.json"))).toBe(false);
    const dependabot = read(".github/dependabot.yml");
    for (const ecosystem of ["npm", "github-actions"]) {
      expect(dependabot).toContain(`package-ecosystem: ${ecosystem}`);
    }
    expect(dependabot.match(/interval: weekly/g)).toHaveLength(2);
    expect(dependabot).toMatch(/update-types:\s*\[minor, patch\]/);
    expect(dependabot).not.toMatch(/update-types:[^\n]*major/);
  });
});
