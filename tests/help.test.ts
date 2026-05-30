import { describe, it, expect } from "vitest";
import {
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
    expect(HELP_TOPIC_SLUGS).toContain("context-profielen");
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
    expect(getTopicTitle("context-profielen", "nl")).toBe("Onderwijscontext instellen");
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
