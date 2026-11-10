import { describe, it, expect } from "vitest";
import { getMessages, LOCALES } from "~/lib/i18n";
import {
  headingSlug,
  topicAnchors,
  getToolById,
  getToolHelpOverlay,
  getTopic,
  getTopicTitle,
  TOOL_OVERLAY_IDS,
  toolOverlayLangs,
  HELP_TOPIC_SLUGS,
  topicLangs,
} from "~/lib/help/registry";
import { getEnabledTools } from "~/lib/registry";
import { AGENTS } from "~/lib/agents/registry";
import { loc } from "~/lib/i18n/localized";

describe("help registry — tool resolution", () => {
  it("resolves a real tool by id and returns undefined for junk", () => {
    expect(getToolById("bloom-by-design")?.id).toBe("bloom-by-design");
    expect(getToolById("does-not-exist")).toBeUndefined();
    expect(getToolById("")).toBeUndefined();
  });

  it("gives every enabled tool a resolvable help page", () => {
    for (const tool of getEnabledTools()) {
      expect(getToolById(tool.id), `enabled tool "${tool.id}" must resolve`).toBeDefined();
    }
  });
});

describe("help registry — topics", () => {
  it("ships the core topics", () => {
    expect(HELP_TOPIC_SLUGS).toContain("getting-started");
    expect(HELP_TOPIC_SLUGS).toContain("context-profiles");
    expect(HELP_TOPIC_SLUGS).toContain("courses");
  });

  it("explains the role-agent review in the courses topic (P21.5)", () => {
    expect(getTopic("courses", "nl")).toContain("## Laat reviewen");
    expect(getTopic("courses", "en")).toContain("## Get a review");
  });

  it("describes every reviewer in its own section, so a new reviewer ships with its help", () => {
    expect(getTopicTitle("review-team", "nl")).toBe("Je reviewteam: wie er meekijkt");
    expect(getTopicTitle("review-team", "en")).toBe("Your review team: who reviews your course");
    for (const lang of LOCALES) {
      const topic = getTopic("review-team", lang) ?? "";
      for (const agent of AGENTS)
        expect(topic, `${lang}: ${agent.id}`).toContain(`## ${loc(agent.role, lang)}`);
    }
    for (const heading of [
      "## Kiezen wie er in je reviewteam zit",
      "## Wat een reviewer ziet",
      "## Wat een reviewer niet doet",
    ])
      expect(getTopic("review-team", "nl")).toContain(heading);
    for (const heading of [
      "## Choosing who is on your review team",
      "## What a reviewer sees",
      "## What a reviewer does not do",
    ])
      expect(getTopic("review-team", "en")).toContain(heading);
    expect(getTopic("courses", "nl")).toContain("(/help/review-team)");
    expect(getTopic("courses", "en")).toContain("(/help/review-team)");
  });

  it("guides a teacher through the BDB and BKE, from switching it on to handing in", () => {
    expect(getTopicTitle("bdb-bke", "nl")).toBe("Je BDB en BKE maken");
    expect(getTopicTitle("bdb-bke", "en")).toBe("Making your BDB and BKE");
    for (const heading of [
      "## Stap 0: de werkplaats aanzetten",
      "## Stap 5: rond af",
      "## Open plekken en het ingeleverde werk",
      "## Elke leeruitkomst apart inleveren",
      "## Verder in Word, en weer terug",
    ])
      expect(getTopic("bdb-bke", "nl")).toContain(heading);
    for (const heading of [
      "## Step 0: switch the workplace on",
      "## Step 5: finish",
      "## Open spots and the work you hand in",
      "## Hand in each learning outcome on its own",
      "## On in Word, and back again",
    ])
      expect(getTopic("bdb-bke", "en")).toContain(heading);
    expect(getTopic("bdb-bke", "nl")).toContain("Op aanvraag");
  });

  it("gives each heading an anchor, and the dossier route links to anchors that exist", () => {
    expect(headingSlug("Stap 3: vul aan met een tool")).toBe("stap-3-vul-aan-met-een-tool");
    expect(headingSlug("Één ÿ — café!")).toBe("een-y-cafe");
    for (const lang of LOCALES) {
      const anchors = topicAnchors("bdb-bke", lang);
      for (const a of Object.values(getMessages(lang).portfolio.route.guideAnchors))
        expect(anchors, `${lang}: #${a}`).toContain(a);
    }
  });

  it("explains the teacher's week and the calendar file (P22.5)", () => {
    expect(getTopicTitle("week", "nl")).toBe("Je week");
    expect(getTopicTitle("week", "en")).toBe("Your week");
    expect(getTopic("week", "nl")).toContain("## In je agenda");
    expect(getTopic("week", "en")).toContain("## In your calendar");
  });

  it("has both nl and en for every topic (no half-translated topics)", () => {
    expect(HELP_TOPIC_SLUGS.length).toBeGreaterThan(0);
    for (const slug of HELP_TOPIC_SLUGS) {
      expect([...topicLangs(slug)].sort(), `topic "${slug}"`).toEqual(["en", "nl"]);
    }
  });

  it("returns per-language topic bodies and null for unknown slugs", () => {
    expect(getTopic("getting-started", "nl")).toContain("Aan de slag");
    expect(getTopic("getting-started", "en")).toContain("Getting started");
    expect(getTopic("does-not-exist", "nl")).toBeNull();
  });

  it("derives a topic title from its first H1", () => {
    expect(getTopicTitle("getting-started", "nl")).toBe("Aan de slag");
    expect(getTopicTitle("getting-started", "en")).toBe("Getting started");
    expect(getTopicTitle("context-profiles", "nl")).toBe("Je onderwijscontext instellen");
    // Unknown slug falls back to the slug itself.
    expect(getTopicTitle("does-not-exist", "nl")).toBe("does-not-exist");
  });
});

describe("help registry — tool overlays", () => {
  it("only lists overlay ids that match a real tool", () => {
    expect(TOOL_OVERLAY_IDS.length).toBeGreaterThan(0);
    for (const id of TOOL_OVERLAY_IDS) {
      expect(getToolById(id), `overlay "${id}" must match a tool`).toBeDefined();
    }
  });

  it("has both nl and en for every overlay present (no half-translated overlays)", () => {
    for (const id of TOOL_OVERLAY_IDS) {
      expect([...toolOverlayLangs(id)].sort(), `overlay "${id}"`).toEqual(["en", "nl"]);
    }
  });

  it("returns per-language overlay content and null when none exists", () => {
    const nl = getToolHelpOverlay("bloom-by-design", "nl");
    const en = getToolHelpOverlay("bloom-by-design", "en");
    expect(nl).toContain("Wanneer gebruik je deze tool?");
    expect(en).toContain("When to use this tool");
    expect(nl).not.toBe(en);
    expect(getToolHelpOverlay("totally-not-a-real-tool", "nl")).toBeNull();
  });
});
