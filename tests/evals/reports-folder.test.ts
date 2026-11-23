import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * What stays in `evals/` (see `evals/reports/README.md`): an eval folder holds its input
 * (cases, rubric or README), a report the repository names still exists, and a raw json in
 * `evals/reports/` stays only while an eval README still reruns from it. Everything else lives
 * in the git history.
 */
const ROOT = process.cwd();
const EVALS = join(ROOT, "evals");
const REPORTS = join(EVALS, "reports");

function textFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (path === REPORTS || name === "node_modules" || name === "output") return [];
    if (statSync(path).isDirectory()) return textFiles(path);
    return /\.(md|ts|tsx)$/.test(name) ? [path] : [];
  });
}

const SOURCES = [
  ...["app", "scripts", "docs", "wiki", "evals"].flatMap((dir) => textFiles(join(ROOT, dir))),
  join(ROOT, "AGENTS.md"),
];

describe("the evals folder stays tidy", () => {
  it("every eval folder holds its input, not raw model output", () => {
    const folders = readdirSync(EVALS).filter(
      (name) =>
        name !== "reports" && name !== "output" && statSync(join(EVALS, name)).isDirectory(),
    );
    const withoutInput = folders.filter(
      (name) =>
        !["README.md", "cases.json", "rubric.md"].some((file) =>
          existsSync(join(EVALS, name, file)),
        ),
    );
    expect(withoutInput).toEqual([]);
  });

  it("every report the repository names still exists", () => {
    const missing = SOURCES.flatMap((file) =>
      [
        ...readFileSync(file, "utf8").matchAll(
          /(?:evals\/reports\/|\.\.\/reports\/)([\w.-]+\.(?:md|json|html))/g,
        ),
      ]
        .map((match) => match[1] ?? "")
        .filter((name) => !existsSync(join(REPORTS, name)))
        .map((name) => `${relative(ROOT, file)} → ${name}`),
    );
    expect(missing).toEqual([]);
  });

  it("a raw json stays only while an eval README still reruns from it", () => {
    const readmes = readdirSync(EVALS)
      .flatMap((name) => ["README.md", "rubric.md"].map((file) => join(EVALS, name, file)))
      .filter((path) => existsSync(path) && !path.startsWith(REPORTS))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    const raws = readdirSync(REPORTS).filter((name) => name.endsWith("-raw.json"));
    expect(raws.filter((name) => !readmes.includes(name))).toEqual([]);
  });
});
