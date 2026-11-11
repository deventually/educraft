/**
 * Pure helpers for releases (BESLUIT-2026-11-11-5): read RELEASE.md and check a tag against it.
 * Tested in tests/deploy/release.test.ts; `scripts/release-notes.ts` runs them in the release
 * workflow.
 */

export interface Release {
  version: string;
  date: string;
  notes: string;
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const HEADING = /^## \[(.+?)\] - (.+)$/;

const parts = (v: string): number[] => v.split(".").map(Number);

/** Negative when `a` is older than `b`, by number (1.10.0 is newer than 1.9.0). */
function compare(a: string, b: string): number {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function isRealDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(date);
}

/**
 * Every release in RELEASE.md, newest first. Each second-level heading is one release,
 * `## [1.2.0] - 2026-11-12`, followed by its notes. Throws on anything else, so a mistake stops
 * the release instead of shipping wrong notes.
 */
export function parseReleases(markdown: string): Release[] {
  const releases: Release[] = [];
  let current: { version: string; date: string; lines: string[] } | null = null;
  const close = () => {
    if (!current) return;
    const notes = current.lines.join("\n").trim();
    if (!notes) throw new Error(`RELEASE.md: ${current.version} has no notes`);
    releases.push({ version: current.version, date: current.date, notes });
  };

  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (line.startsWith("```")) inFence = !inFence;
    if (inFence || !line.startsWith("## ")) {
      current?.lines.push(line);
      continue;
    }
    const m = HEADING.exec(line.trim());
    if (!m) throw new Error(`RELEASE.md: "${line}" is not "## [X.Y.Z] - YYYY-MM-DD"`);
    const [, version = "", date = ""] = m;
    if (!SEMVER.test(version)) throw new Error(`RELEASE.md: ${version} is not X.Y.Z (SemVer)`);
    if (!isRealDate(date)) throw new Error(`RELEASE.md: ${version} has no valid date (${date})`);
    close();
    const previous = releases.at(-1);
    if (previous && compare(previous.version, version) <= 0) {
      throw new Error(`RELEASE.md: list releases newest first (${version} under ${previous.version})`);
    }
    current = { version, date, lines: [] };
  }
  close();
  return releases;
}

/** The notes of one version, for its GitHub Release. */
export function releaseNotes(markdown: string, version: string): string {
  const release = parseReleases(markdown).find((r) => r.version === version);
  if (!release) throw new Error(`RELEASE.md has no entry for ${version}`);
  return release.notes;
}

/**
 * Checks a release tag: `vX.Y.Z`, equal to package.json's version and the newest entry in
 * RELEASE.md. Returns the version without the `v`.
 */
export function checkTag(tag: string, packageVersion: string, markdown: string): string {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error(`Tag ${tag} is not vX.Y.Z`);
  const version = tag.slice(1);
  if (version !== packageVersion) {
    throw new Error(`Tag ${tag} does not match package.json (${packageVersion})`);
  }
  const newest = parseReleases(markdown)[0];
  if (newest?.version !== version) {
    throw new Error(`Tag ${tag} is not the newest entry in RELEASE.md (${newest?.version ?? "none"})`);
  }
  return version;
}
