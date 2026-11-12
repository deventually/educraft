import type { RaterWork } from "./calibrate";
import type { RubricData } from "./schema";

/**
 * Reading one rater's scores for calibrating (P34.2), as pasted from Excel or the template CSV:
 * a code, then per criterion the level label as the rubric has it. Pure; nothing leaves the
 * browser.
 */
export type RaterTextError =
  | { line: number; kind: "unknownLevel"; criterion: string; value: string }
  | { line: number; kind: "noCode" | "tooManyColumns"; value: string };

const norm = (s: string) => s.trim().toLowerCase();

function delimiter(line: string): string {
  if (line.includes("\t")) return "\t";
  return line.includes(";") ? ";" : ",";
}

/** Split one line on `sep`, honouring "double ""quoted"" cells". */
function cells(line: string, sep: string): string[] {
  const out: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (ch === sep) {
      out.push(cell);
      cell = "";
    } else cell += ch;
  }
  out.push(cell);
  return out.map((c) => c.trim());
}

export function parseRaterText(
  data: RubricData,
  text: string,
): { works: RaterWork[]; errors: RaterTextError[] } {
  const works: RaterWork[] = [];
  const errors: RaterTextError[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = i + 1;
    if (!raw.trim()) return;
    const [code = "", ...levels] = cells(raw, delimiter(raw));
    if (line === 1 && norm(code) === "code") return;
    if (!code) {
      errors.push({ line, kind: "noCode", value: "" });
      return;
    }
    const extra = levels.slice(data.criteria.length).find((c) => c !== "");
    if (extra !== undefined) {
      errors.push({ line, kind: "tooManyColumns", value: extra });
      return;
    }
    const choice: Record<string, string> = {};
    let ok = true;
    data.criteria.forEach((c, j) => {
      const value = levels[j] ?? "";
      if (!value) return;
      const level = c.levels.find((l) => norm(l.label) === norm(value));
      if (level) choice[c.id] = level.id;
      else {
        ok = false;
        errors.push({ line, kind: "unknownLevel", criterion: c.title, value });
      }
    });
    if (ok) works.push({ code, choice });
  });
  return { works, errors };
}

const csvCell = (s: string) => (/[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** The example CSV to download: one header row (code; criterion titles), semicolons for Excel. */
export function calibrationTemplate(data: RubricData): string {
  return `${["code", ...data.criteria.map((c) => c.title)].map(csvCell).join(";")}\r\n`;
}
