/**
 * CI audit of the whole dependency tree (dev tools too), from high up, with dated exceptions
 * (BESLUIT-2026-11-17-7). Production dependencies are audited apart, from moderate up and without
 * exceptions (`npm audit --omit=dev --audit-level=moderate` in ci.yml).
 *
 *   node scripts/audit.ts
 *
 * An exception in `config/audit-exceptions.json` lets one advisory in one package through until
 * its `until` date; after that the check is red again. Plain Node (type stripping), no imports
 * beyond node:, so the audit job needs no `npm ci`.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface AuditException {
  /** GitHub advisory id, e.g. GHSA-fc5q-39xc-vjpf. */
  id: string;
  /** The package the advisory is about (where npm audit finds it). */
  package: string;
  reason: string;
  /** ISO dates (YYYY-MM-DD). `until` is the last day the exception holds. */
  added: string;
  until: string;
}

interface Verdict {
  blocking: string[];
  excepted: string[];
  unused: string[];
}

const BLOCKING = new Set(["high", "critical"]);

interface Advisory {
  id: string;
  pkg: string;
  severity: string;
}

function advisoriesOf(report: unknown): Advisory[] {
  const vulnerabilities = (report as { vulnerabilities?: unknown })?.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities !== "object") {
    throw new Error("npm audit output has no `vulnerabilities`; refusing to call it clean");
  }
  const found = new Map<string, Advisory>();
  for (const [pkg, entry] of Object.entries(vulnerabilities as Record<string, { via?: unknown[] }>)) {
    for (const via of entry.via ?? []) {
      if (typeof via !== "object" || via === null) continue; // a dependency, reported on its own
      const { url, severity } = via as { url?: string; severity?: string };
      const id = url?.split("/").pop() ?? "unknown";
      found.set(`${id} ${pkg}`, { id, pkg, severity: severity ?? "unknown" });
    }
  }
  return [...found.values()];
}

export function auditVerdict(report: unknown, exceptions: AuditException[], today: string): Verdict {
  const verdict: Verdict = { blocking: [], excepted: [], unused: [] };
  const used = new Set<AuditException>();
  for (const a of advisoriesOf(report)) {
    if (!BLOCKING.has(a.severity) && a.severity !== "unknown") continue;
    const label = `${a.id} (${a.pkg}, ${a.severity})`;
    const exception = exceptions.find((e) => e.id === a.id && e.package === a.pkg);
    if (!exception) verdict.blocking.push(label);
    else {
      used.add(exception);
      if (today > exception.until) verdict.blocking.push(`${label}: exception expired ${exception.until}`);
      else verdict.excepted.push(label);
    }
  }
  verdict.unused = exceptions.filter((e) => !used.has(e)).map((e) => `${e.id} (${e.package})`);
  return verdict;
}

function main(): void {
  const root = resolve(fileURLToPath(import.meta.url), "../..");
  const exceptions = JSON.parse(
    readFileSync(resolve(root, "config/audit-exceptions.json"), "utf8"),
  ) as AuditException[];
  // npm audit exits non-zero when it finds anything; the JSON on stdout is what counts.
  const run = spawnSync("npm", ["audit", "--json"], { cwd: root, encoding: "utf8" });
  const verdict = auditVerdict(JSON.parse(run.stdout), exceptions, new Date().toISOString().slice(0, 10));
  for (const e of verdict.excepted) console.log(`excepted until its date: ${e}`);
  for (const e of verdict.unused) console.log(`exception no longer needed, remove it: ${e}`);
  for (const e of verdict.blocking) console.error(`blocking: ${e}`);
  if (verdict.blocking.length > 0) process.exit(1);
  console.log("audit: no high or critical advisories without a current exception");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
