/**
 * One place for the model choice: `config/models.json`. Raising the default there must
 * reach every tool, every script and every eval judge, so no source file may name an
 * API model by its id. Code points at `DEFAULT_MODEL` (or a model from the catalog).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import modelsConfig from "../config/models.json";
import { DEFAULT_MODEL, LOCAL_PROVIDERS } from "~/lib/ai/models";
import { ALL_TOOLS, WORKPLACE_TOOLS } from "~/lib/registry";
import { DEFAULT_JUDGE_MODEL } from "../scripts/eval-helpers";

const ROOT = join(__dirname, "..");
const SCANNED = ["app", "scripts"];

/**
 * Files that may name a model id, with the reason. Keep this list short.
 * - eval-batch.ts mirrors the AI SDK's list of API-id prefixes that refuse a
 *   temperature: a capability of the provider, not a choice of model.
 */
const ALLOWED = new Set(["scripts/eval-batch.ts"]);

const local = new Set<string>(LOCAL_PROVIDERS);
const apiModelIds = modelsConfig.models
  .filter((m) => !local.has(m.provider))
  .flatMap((m) => [m.id, m.apiId]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|mjs)$/.test(name) ? [path] : [];
  });
}

describe("model ids live only in config/models.json", () => {
  it("no app or script file names an API model by its id", () => {
    const offenders: string[] = [];
    for (const dir of SCANNED) {
      for (const file of sourceFiles(join(ROOT, dir))) {
        const rel = relative(ROOT, file);
        if (ALLOWED.has(rel)) continue;
        const text = readFileSync(file, "utf8");
        for (const id of new Set(apiModelIds)) {
          if (text.includes(`"${id}"`) || text.includes(`'${id}'`) || text.includes(`\`${id}\``)) {
            offenders.push(`${rel}: ${id}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every tool starts on the default model", () => {
    for (const tool of [...ALL_TOOLS, ...WORKPLACE_TOOLS])
      expect(tool.defaultModel, tool.slug).toBe(DEFAULT_MODEL);
  });

  it("the eval judge is the default model", () => {
    expect(DEFAULT_JUDGE_MODEL).toBe(DEFAULT_MODEL);
  });
});
