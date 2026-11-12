import { describe, expect, it } from "vitest";
import { feedbackHistory, HISTORY_LIMIT } from "~/lib/tracks/history";

const round = (milestone: string, n: number, text: string) => ({
  milestone,
  round: n,
  feedback: { text },
});

describe("feedbackHistory (P38.4)", () => {
  it("lists the earlier feedback oldest first, each under its milestone and round", () => {
    const h = feedbackHistory(
      [
        round("start", 1, "Maak de vraag meetbaar."),
        round("drafts", 1, "Noem bronnen."),
        round("drafts", 2, "  "),
        round("drafts", 3, "De bronnen staan er."),
      ],
      "nl",
    );
    expect(h).toBe(
      [
        "### Start, ronde 1",
        "Maak de vraag meetbaar.",
        "",
        "### Concepten, ronde 1",
        "Noem bronnen.",
        "",
        "### Concepten, ronde 3",
        "De bronnen staan er.",
      ].join("\n"),
    );
    expect(feedbackHistory([round("drafts", 1, "Cite.")], "en")).toMatch(
      /^### .+, round 1\nCite\.$/,
    );
  });

  it("is empty without feedback, and keeps the newest rounds when it is long", () => {
    expect(feedbackHistory([], "nl")).toBe("");
    const long = "x".repeat(HISTORY_LIMIT / 2);
    const h = feedbackHistory(
      [
        round("drafts", 1, `OUD ${long}`),
        round("drafts", 2, `MIDDEN ${long}`),
        round("drafts", 3, "NIEUW"),
      ],
      "nl",
    );
    expect(h.length).toBeLessThanOrEqual(HISTORY_LIMIT);
    expect(h).toContain("NIEUW");
    expect(h).toContain("MIDDEN");
    expect(h).not.toContain("OUD");
  });
});
