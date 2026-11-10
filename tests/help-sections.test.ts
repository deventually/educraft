import { describe, it, expect } from "vitest";
import { LOCALES } from "~/lib/i18n";
import {
  getTopic,
  getTopicTitle,
  getToolHelpOverlay,
  HELP_TOPIC_SLUGS,
  topicAnchors,
  getToolById,
  TOOL_OVERLAY_IDS,
} from "~/lib/help/registry";
import { HELP_SECTIONS, helpSections, topicIsAdminOnly } from "~/lib/help/sections";
import { searchHelp } from "~/lib/help/search";

describe("help sections — the order of /help", () => {
  it("puts every topic in exactly one section, so a new topic is never lost", () => {
    const listed = HELP_SECTIONS.flatMap((s) => s.topics);
    for (const slug of HELP_TOPIC_SLUGS)
      expect(
        listed.filter((s) => s === slug),
        `topic "${slug}"`,
      ).toHaveLength(1);
  });

  it("starts with getting started and keeps the admin topic for admins", () => {
    const teacher = helpSections("nl", { isAdmin: false });
    expect(teacher[0]?.topics[0]?.slug).toBe("getting-started");
    expect(teacher.flatMap((s) => s.topics.map((t) => t.slug))).not.toContain("admin");
    const admin = helpSections("nl", { isAdmin: true });
    expect(admin.flatMap((s) => s.topics.map((t) => t.slug))).toContain("admin");
    expect(topicIsAdminOnly("admin")).toBe(true);
    expect(topicIsAdminOnly("account")).toBe(false);
  });

  it("leaves out a listed topic that has no file (yet), and an empty section", () => {
    for (const lang of LOCALES)
      for (const section of helpSections(lang, { isAdmin: true })) {
        expect(section.topics.length).toBeGreaterThan(0);
        for (const t of section.topics) expect(HELP_TOPIC_SLUGS).toContain(t.slug);
      }
  });

  it("gives each listed topic its title and its section headings with their anchors", () => {
    const account = helpSections("nl", { isAdmin: false })
      .flatMap((s) => s.topics)
      .find((t) => t.slug === "account");
    expect(account?.title).toBe("Je account");
    expect(account?.headings.map((h) => h.anchor)).toEqual(topicAnchors("account", "nl"));
  });
});

describe("help topics — up to date with the app", () => {
  const NEW_TOPICS: [string, string, string][] = [
    ["using-tools", "Met een tool werken", "Working with a tool"],
    [
      "saved-work",
      "Eerder gemaakt: terugvinden en exporteren",
      "Earlier work: find it and export it",
    ],
    ["utilities", "Hulpmiddelen zonder AI", "Utilities without AI"],
    ["teams", "Teams en delen", "Teams and sharing"],
    ["admin", "Voor beheerders", "For administrators"],
  ];

  it.each(NEW_TOPICS)("ships the topic %s in both languages", (slug, nl, en) => {
    expect(getTopicTitle(slug, "nl")).toBe(nl);
    expect(getTopicTitle(slug, "en")).toBe(en);
  });

  it("no longer says LimeOnIt is only for higher education", () => {
    expect(getTopic("getting-started", "nl")).not.toMatch(/voor het hbo/);
    expect(getTopic("getting-started", "nl")).toMatch(/vo, mbo, hbo en wo/);
  });

  it("explains two-step verification and logging out everywhere on the account topic", () => {
    expect(getTopic("account", "nl")).toContain("## Tweestapsverificatie");
    expect(getTopic("account", "nl")).toContain("Overal uitloggen");
    expect(getTopic("account", "en")).toContain("## Two-step verification");
    expect(getTopic("account", "en")).toContain("Log out everywhere");
  });

  it("says what happens to a student's document, on the tools topic", () => {
    expect(getTopic("using-tools", "nl")).toContain("## Documenten en studentwerk");
    expect(getTopic("using-tools", "en")).toContain("## Documents and student work");
  });

  it("has a guide for the engagement check", () => {
    expect(getToolHelpOverlay("engagement-check", "nl")).toContain(
      "## Wanneer gebruik je deze tool?",
    );
    expect(getToolHelpOverlay("engagement-check", "en")).toContain("## When to use this tool");
  });

  it("only links to help pages that exist, from topics and tool guides", () => {
    for (const lang of LOCALES)
      for (const slug of [...HELP_TOPIC_SLUGS, ...TOOL_OVERLAY_IDS]) {
        const body = getTopic(slug, lang) ?? getToolHelpOverlay(slug, lang) ?? "";
        for (const [, target] of body.matchAll(/\]\(\/help\/([a-z0-9-]+)/g)) {
          const ok = HELP_TOPIC_SLUGS.includes(target ?? "") || !!getToolById(target ?? "");
          expect(ok, `${lang} ${slug} → /help/${target}`).toBe(true);
        }
      }
  });
});

describe("help search", () => {
  const items = [
    {
      href: "/help/account",
      title: "Je account",
      search: "je account wachtwoord tweestapsverificatie herstelcodes",
      headings: [
        { text: "Tweestapsverificatie", anchor: "tweestapsverificatie" },
        { text: "Je account verwijderen", anchor: "je-account-verwijderen" },
      ],
    },
    { href: "/help/rubric-builder", title: "Rubric", search: "rubric criteria", headings: [] },
  ];

  it("returns nothing for an empty query", () => {
    expect(searchHelp(items, "  ")).toEqual([]);
  });

  it("finds a page by a word in its text, and points at the matching heading", () => {
    const hits = searchHelp(items, "tweestap");
    expect(hits.map((h) => h.href)).toEqual(["/help/account"]);
    expect(hits[0]?.headings).toEqual([
      { text: "Tweestapsverificatie", anchor: "tweestapsverificatie" },
    ]);
  });

  it("ignores case and accents", () => {
    expect(searchHelp(items, "RÜBRIC").map((h) => h.href)).toEqual(["/help/rubric-builder"]);
  });
});
