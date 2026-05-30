import type { Tool } from "~/lib/registry/types";
import { ALL_TOOLS } from "~/lib/registry";

/**
 * End-user help layer. Help pages are derived from the live tool registry (so
 * the overview never drifts) and enriched with optional hand-authored Markdown
 * overlays. This keeps `wiki/` for developers and `app/content/help/` for users.
 *
 * Files:
 *   app/content/help/tools/<toolId>.{nl,en}.md   — "how to use" per tool
 *   app/content/help/topics/<slug>.{nl,en}.md    — general topics
 *
 * Overlays are loaded at build time via import.meta.glob (?raw). A tool without
 * an overlay still has a help page (the registry-derived overview renders).
 */
const raw = import.meta.glob("../../content/help/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export type HelpLang = "nl" | "en";

type Bucket = Record<string, Partial<Record<HelpLang, string>>>;

const overlays: { tools: Bucket; topics: Bucket } = { tools: {}, topics: {} };

for (const [path, content] of Object.entries(raw)) {
  const m = path.match(/\/content\/help\/(tools|topics)\/(.+)\.(nl|en)\.md$/);
  if (!m) continue;
  const kind = m[1] as "tools" | "topics";
  const base = m[2] as string;
  const lang = m[3] as HelpLang;
  overlays[kind][base] ??= {};
  overlays[kind][base][lang] = content;
}

export function getToolById(id: string): Tool | undefined {
  return ALL_TOOLS.find((t) => t.id === id);
}

/** Hand-authored "how to use" overlay for a tool, or null if none exists yet. */
export function getToolHelpOverlay(id: string, lang: HelpLang): string | null {
  const o = overlays.tools[id];
  return o?.[lang] ?? o?.nl ?? o?.en ?? null;
}

/** Tool ids that ship a hand-authored overlay (for parity checks). */
export const TOOL_OVERLAY_IDS: string[] = Object.keys(overlays.tools).sort();

export function toolOverlayLangs(id: string): HelpLang[] {
  return Object.keys(overlays.tools[id] ?? {}) as HelpLang[];
}

/** Slugs of general help topics (getting started, context profiles, …). */
export const HELP_TOPIC_SLUGS: string[] = Object.keys(overlays.topics).sort();

export function getTopic(slug: string, lang: HelpLang): string | null {
  const o = overlays.topics[slug];
  return o?.[lang] ?? o?.nl ?? o?.en ?? null;
}

export function topicLangs(slug: string): HelpLang[] {
  return Object.keys(overlays.topics[slug] ?? {}) as HelpLang[];
}

/** First Markdown H1 of a topic, used as its title in the index/nav. */
export function getTopicTitle(slug: string, lang: HelpLang): string {
  const body = getTopic(slug, lang) ?? "";
  const m = body.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : slug;
}
