/**
 * Paste-ready texts in a result (`OutputFormat.copyBlocks`): the sub-headings under one named
 * heading, each a block the teacher copies on its own, such as a summary per report for OnStage.
 * Pure; reads the markdown the prompt was asked to write and tolerates numbering and bold lines.
 */
export interface CopyBlock {
  title: string;
  text: string;
}

/** A heading: `## …` (level 1–6) or a line that is bold as a whole (level 7: below any `#`). */
function headingOf(line: string): { level: number; title: string } | null {
  const hash = /^(#{1,6})\s+(.*)$/.exec(line.trim());
  if (hash) return { level: hash[1]?.length ?? 1, title: clean(hash[2] ?? "") };
  const bold = /^\*\*(.+?)\*\*:?$/.exec(line.trim());
  return bold ? { level: 7, title: clean(bold[1] ?? "") } : null;
}

/** Without bold markers, a leading number ("4." or "5)") and a trailing colon. */
const clean = (title: string) =>
  title
    .replace(/\*\*|__/g, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/:$/, "")
    .trim();

const plain = (text: string) => text.replace(/\*\*|__/g, "").trim();

export function copyBlocksOf(markdown: string, heading: string): CopyBlock[] {
  const wanted = heading.trim().toLowerCase();
  if (!wanted) return [];
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => headingOf(l)?.title.toLowerCase().startsWith(wanted));
  const top = headingOf(lines[start] ?? "");
  if (!top) return [];
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const h = headingOf(line);
    // Only a `#` heading as high as the top one (any, under a bold top) or a rule ends it.
    if ((h && h.level <= Math.min(top.level, 6)) || /^\s*---+\s*$/.test(line)) break;
    body.push(line);
  }
  const blocks: CopyBlock[] = [];
  // The headings above the current one, so a deeper block reads "Stageverslag · SC1".
  const path: { level: number; title: string }[] = [];
  let current: CopyBlock | null = null;
  for (const line of body) {
    const h = headingOf(line);
    if (h) {
      while ((path.at(-1)?.level ?? 0) >= h.level) path.pop();
      path.push(h);
      current = { title: path.map((p) => p.title).join(" · "), text: "" };
      blocks.push(current);
    } else if (current) current.text += `${line}\n`;
    else if (line.trim()) {
      current = { title: top.title, text: `${line}\n` };
      blocks.push(current);
    }
  }
  return blocks.map((b) => ({ title: b.title, text: plain(b.text) })).filter((b) => b.text);
}
