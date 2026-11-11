import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkTag, parseReleases, releaseNotes } from "../../scripts/release-helpers";

/**
 * Releases (BESLUIT-2026-11-11-4): a SemVer git tag `vX.Y.Z` on main, the same version in
 * package.json, and an entry with its date in RELEASE.md. The tag builds the image on ghcr.io and
 * a GitHub Release with the notes from RELEASE.md.
 */
const root = resolve(__dirname, "../..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

const RELEASE_MD = `# Releases

Intro text.

## [1.1.0] - 2026-12-01

Nieuw: een knop.

## [1.0.0] - 2026-11-12

De eerste release.
`;

describe("parseReleases", () => {
  it("reads every version with its date, newest first", () => {
    expect(parseReleases(RELEASE_MD)).toEqual([
      { version: "1.1.0", date: "2026-12-01", notes: "Nieuw: een knop." },
      { version: "1.0.0", date: "2026-11-12", notes: "De eerste release." },
    ]);
  });

  it("has no releases yet when there is no entry", () => {
    expect(parseReleases("# Releases\n\nNog niets.\n")).toEqual([]);
  });

  it.each([
    ["a version that is not SemVer", "## [1.0] - 2026-11-12\n\nx\n"],
    ["a date that is not YYYY-MM-DD", "## [1.0.0] - 12-11-2026\n\nx\n"],
    ["an impossible date", "## [1.0.0] - 2026-13-40\n\nx\n"],
    ["an entry without notes", "## [1.0.0] - 2026-11-12\n\n"],
    ["a second level heading that is no release", "## Wat er komt\n\nx\n"],
  ])("refuses %s", (_label, md) => {
    expect(() => parseReleases(md)).toThrow();
  });

  it("refuses an older version above a newer one", () => {
    const md = "## [1.0.0] - 2026-11-12\n\na\n\n## [1.1.0] - 2026-12-01\n\nb\n";
    expect(() => parseReleases(md)).toThrow(/newest first/);
  });

  it("refuses the same version twice", () => {
    const md = "## [1.0.0] - 2026-11-12\n\na\n\n## [1.0.0] - 2026-11-12\n\nb\n";
    expect(() => parseReleases(md)).toThrow();
  });

  it("compares versions as numbers, not as text (1.10.0 is newer than 1.9.0)", () => {
    const md = "## [1.10.0] - 2026-12-01\n\na\n\n## [1.9.0] - 2026-11-12\n\nb\n";
    expect(parseReleases(md).map((r) => r.version)).toEqual(["1.10.0", "1.9.0"]);
  });
});

describe("releaseNotes", () => {
  it("gives the notes of one version, for the GitHub Release", () => {
    expect(releaseNotes(RELEASE_MD, "1.0.0")).toBe("De eerste release.");
  });

  it("refuses a version RELEASE.md does not have", () => {
    expect(() => releaseNotes(RELEASE_MD, "2.0.0")).toThrow(/RELEASE\.md/);
  });
});

describe("checkTag", () => {
  it("accepts a tag that matches package.json and is the newest entry", () => {
    expect(checkTag("v1.1.0", "1.1.0", RELEASE_MD)).toBe("1.1.0");
  });

  it.each([
    ["a tag without the v", "1.1.0", "1.1.0"],
    ["a tag that differs from package.json", "v1.1.0", "1.0.0"],
    ["a tag that is not the newest entry", "v1.0.0", "1.0.0"],
    ["a tag RELEASE.md does not have", "v2.0.0", "2.0.0"],
  ])("refuses %s", (_label, tag, pkgVersion) => {
    expect(() => checkTag(tag, pkgVersion, RELEASE_MD)).toThrow();
  });
});

describe("the repository itself", () => {
  const pkg = JSON.parse(read("package.json")) as { version?: string };
  const releases = parseReleases(read("RELEASE.md"));

  it("has a SemVer version in package.json", () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("has package.json at the newest release, or at 0.0.0 before the first one", () => {
    expect(pkg.version).toBe(releases[0]?.version ?? "0.0.0");
  });
});

describe("release workflow", () => {
  const workflow = read(".github/workflows/release.yml");

  it("runs only for a version tag", () => {
    expect(workflow).toMatch(/on:\s*\n\s+push:\s*\n\s+tags:\s*\[\s*"v\*\.\*\.\*"\s*\]/);
    expect(workflow).not.toMatch(/pull_request|branches:/);
  });

  it("checks the tag against package.json and RELEASE.md before it builds anything", () => {
    const check = workflow.indexOf("scripts/release-notes.ts");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(workflow.indexOf("docker/build-push-action"));
    expect(workflow).toMatch(/\$\{\{ github\.ref_name \}\}/);
  });

  it("pushes the image to ghcr.io under its exact version, never a floating tag", () => {
    expect(workflow).toContain("ghcr.io/deventually/educraft");
    expect(workflow).toMatch(/push: true/);
    expect(workflow).not.toMatch(/:latest\b/);
  });

  it("makes a GitHub Release with the notes from RELEASE.md", () => {
    expect(workflow).toMatch(/gh release create[\s\S]*--notes-file/);
  });

  it("asks only for the permissions it needs", () => {
    expect(workflow).toMatch(/permissions:\s*\n\s+contents: write\s*\n\s+packages: write/);
  });
});

describe("guardrails for Claude sessions", () => {
  const settings = JSON.parse(read(".claude/settings.json")) as { permissions: { deny: string[] } };

  it.each(["Bash(git tag:*)", "Bash(git push --tags:*)", "Bash(gh release:*)"])(
    "denies %s: only Bastiaan sets a release tag",
    (rule) => {
      expect(settings.permissions.deny).toContain(rule);
    },
  );
});
