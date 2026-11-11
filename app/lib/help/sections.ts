import { loc, type LocalizedText } from "~/lib/i18n/localized";
import { getTopic, getTopicTitle, HELP_TOPIC_SLUGS, headingSlug, type HelpLang } from "./registry";

/**
 * The order of /help: topics grouped by what a teacher wants to do, not by file name. Pure
 * data. A listed slug without a file is left out (so a topic can be listed before it ships),
 * and every topic file must be listed here (tests/help-sections.test.ts).
 */
interface HelpSection {
  id: string;
  title: LocalizedText;
  topics: readonly string[];
  /**
   * Only for whom this is true: an admin, or a teacher with the BDB/BKE workplace. Hidden from
   * the others on /help, and the topic page itself is a 404 for them.
   */
  requires?: keyof HelpAccess;
}

/** What the viewer may see; the server decides (role, `portfolioAccess`). */
export interface HelpAccess {
  isAdmin: boolean;
  portfolio: boolean;
}

export const HELP_SECTIONS: readonly HelpSection[] = [
  { id: "start", title: { nl: "Begin hier", en: "Start here" }, topics: ["getting-started"] },
  {
    id: "tools",
    title: { nl: "Met de tools werken", en: "Working with the tools" },
    topics: ["using-tools", "saved-work", "utilities"],
  },
  {
    id: "teaching",
    title: { nl: "Je onderwijs", en: "Your teaching" },
    topics: ["context-profiles", "courses", "programmes", "week", "review-team"],
  },
  { id: "together", title: { nl: "Samenwerken", en: "Working together" }, topics: ["teams"] },
  {
    id: "bdb-bke",
    title: { nl: "BDB en BKE", en: "BDB and BKE" },
    topics: ["bdb-bke"],
    requires: "portfolio",
  },
  {
    id: "account",
    title: { nl: "Je account", en: "Your account" },
    topics: ["account", "usage"],
  },
  {
    id: "admin",
    title: { nl: "Beheer", en: "Administration" },
    topics: ["admin"],
    requires: "isAdmin",
  },
];

const sectionVisible = (s: HelpSection, access: HelpAccess) =>
  s.requires === undefined || access[s.requires];

/** Whether this viewer may open the topic: not when its section requires what they lack. */
export function topicVisible(slug: string, access: HelpAccess): boolean {
  return !HELP_SECTIONS.some((s) => s.topics.includes(slug) && !sectionVisible(s, access));
}

/** Markdown reduced to lower-case words, for search. */
function plain(markdown: string): string {
  return markdown
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/[#*_>`[\]|]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** The sections a user sees on /help, with each topic's title, headings and search text. */
export function helpSections(lang: HelpLang, access: HelpAccess) {
  return HELP_SECTIONS.filter((s) => sectionVisible(s, access))
    .map((s) => ({
      id: s.id,
      title: loc(s.title, lang),
      topics: s.topics
        .filter((slug) => HELP_TOPIC_SLUGS.includes(slug))
        .map((slug) => {
          const body = getTopic(slug, lang) ?? "";
          return {
            slug,
            title: getTopicTitle(slug, lang),
            search: plain(body),
            headings: [...body.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => {
              const text = (m[1] ?? "").trim();
              return { text, anchor: headingSlug(text) };
            }),
          };
        }),
    }))
    .filter((s) => s.topics.length > 0);
}
