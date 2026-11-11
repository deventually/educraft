/**
 * Release workflow step: checks the tag and prints its notes from RELEASE.md.
 *
 *   npx tsx scripts/release-notes.ts v1.2.0 > notes.md
 *
 * Exits non-zero when the tag, package.json and RELEASE.md disagree, so nothing gets built.
 */
import { readFileSync } from "node:fs";
import { checkTag, releaseNotes } from "./release-helpers";

const tag = process.argv[2] ?? "";
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
const markdown = readFileSync("RELEASE.md", "utf8");

const version = checkTag(tag, pkg.version, markdown);
console.log(releaseNotes(markdown, version));
