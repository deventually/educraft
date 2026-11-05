/**
 * Boot-time registry validation (Phase 5.5). `validateTools` used to run only in
 * the test suite; a typo introduced after a test run could ship. This module runs
 * the same checks once at server startup:
 *
 *   - **dev** → throw (fail fast; the developer sees the bad tool immediately);
 *   - **production** → log each issue and *exclude* the invalid tool, so one typo
 *     in one tool can never take the whole instance down.
 *
 * Server-only (`.server`): `validate` imports every prompt `.md` and the model
 * catalog, which must never be pulled into the client bundle. The excluded slugs
 * are consumed by `availability.server` so an invalid tool disappears from every
 * listing and the stream refuses it.
 */
import { ALL_TOOLS } from "./index";
import { validateTools, type ValidationIssue } from "./validate";
import type { Tool } from "./types";
import { log } from "~/server/log.server";
import { FEATURES, validateFeatures } from "~/lib/features";
import { FINDING_TOOLS, validateFindingTools } from "./courseActions";

export interface RegistryValidationResult {
  /** Tools that passed validation (all of them in a healthy build). */
  validTools: Tool[];
  /** Slugs excluded because they failed validation. */
  invalidSlugs: Set<string>;
  issues: ValidationIssue[];
}

/**
 * Validate a tool list. With `throwOnInvalid` a single issue throws (dev); without
 * it, invalid tools are filtered out and every issue is logged (production).
 */
export function validateRegistry(
  tools: Tool[],
  opts: { throwOnInvalid: boolean },
): RegistryValidationResult {
  const issues = validateTools(tools);
  const invalidSlugs = new Set(issues.map((i) => i.tool));

  if (issues.length > 0) {
    if (opts.throwOnInvalid) {
      const detail = issues.map((i) => `  • ${i.tool}: ${i.message}`).join("\n");
      throw new Error(`Invalid tool registry (${issues.length} issue(s)):\n${detail}`);
    }
    for (const issue of issues) {
      log("registry_invalid_tool", { tool: issue.tool, message: issue.message });
    }
  }

  const validTools = tools.filter((t) => !invalidSlugs.has(t.slug));
  return { validTools, invalidSlugs, issues };
}

let cached: RegistryValidationResult | null = null;

/**
 * Validate the real registry once per server process. Dev fails fast; production
 * logs + excludes. Idempotent — the result is memoised.
 */
export function ensureRegistryValidated(): RegistryValidationResult {
  if (!cached) {
    const throwOnInvalid = process.env.NODE_ENV !== "production";
    cached = validateRegistry(ALL_TOOLS, { throwOnInvalid });
    // The feature register (P28.3) is data too: the same dev-fails-fast rule.
    // So is "Los op met…" (P27.4): every finding points to a known tool.
    const featureIssues = [
      ...validateFeatures(FEATURES),
      ...validateFindingTools(FINDING_TOOLS, ALL_TOOLS),
    ];
    if (featureIssues.length > 0) {
      if (throwOnInvalid) throw new Error(`Invalid feature register:\n${featureIssues.join("\n")}`);
      for (const message of featureIssues) log("registry_invalid_feature", { message });
    }
  }
  return cached;
}

/** Slugs excluded at boot because they failed validation (empty in a healthy build). */
export function getInvalidToolSlugs(): Set<string> {
  return ensureRegistryValidated().invalidSlugs;
}
