/**
 * The leak set of the anonymiser (anonymiseerpoort, PR 1): runs the redaction engine over the
 * fictitious texts in `evals/privacy-leakset/` and writes one HTML report. Plain code, no model,
 * free, a second or so.
 *
 *   npm run eval:leakset -- --label a     # evals/reports/<date>a-lekset.html
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EVALS_DIR, REPORTS_DIR } from "./eval-files";
import { type LeakCase, leaksetHtml, scoreLeakset } from "./eval-leakset-helpers";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const load = (name: string) =>
  (JSON.parse(readFileSync(join(EVALS_DIR, "privacy-leakset", `${name}.json`), "utf8")) as {
    cases: LeakCase[];
  }).cases;

const date = new Date().toISOString().slice(0, 10);
const label = (arg("label") ?? "").replace(/[^a-z0-9-]/gi, "");
const sets = [
  { name: "Afstemset", result: scoreLeakset(load("tuning")) },
  { name: "Toetsset", result: scoreLeakset(load("holdout")) },
];
mkdirSync(REPORTS_DIR, { recursive: true });
const file = join(REPORTS_DIR, `${date}${label}-lekset.html`);
writeFileSync(file, leaksetHtml(sets, date));
for (const s of sets) {
  console.log(
    `${s.name}: ${s.result.wrong.length}/${s.result.totals.mustStay} onterecht vervangen, ${s.result.leaks.length} doorgeglipt (${s.result.totals.mustGo} plekken)`,
  );
}
console.log(`Rapport: ${file}`);
