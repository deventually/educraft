import { describe, it, expect, vi } from "vitest";
import {
  parseSessionSummary,
  clampHelpfulness,
  checkLeakage,
  validateSummaryOutput,
  type SessionSummary,
} from "~/lib/insight/summary";
import { summariseSession } from "~/lib/insight/summarise";

// A transcript carrying BOTH a sensitive personal disclosure ("faalangst") and a
// distinctive, verbatim-quotable phrase. The de-personalisation contract forbids
// either surfacing in a mentor-facing summary.
const transcript = [
  "**Jij:** Ik snap de kettingregel niet en ik heb echt last van faalangst bij wiskunde.",
  "**Assistent:** Laten we het stap voor stap bekijken. Wat is de buitenste functie?",
  "**Jij:** De buitenste functie is de sinus, denk ik.",
  "**Assistent:** Precies. En wat is de binnenste functie?",
].join("\n\n");

const clean: SessionSummary = {
  topicsWorkedOn: ["de kettingregel", "samengestelde functies"],
  skillsProgressed: ["het herkennen van binnenste en buitenste functies"],
  misconceptions: ["verwart de volgorde van differentiëren bij samenstelling"],
  effort: "high",
};

describe("session-summary Zod validation", () => {
  it("returns null for non-JSON output", () => {
    expect(parseSessionSummary("this is not json")).toBeNull();
    expect(parseSessionSummary("")).toBeNull();
  });

  it("returns null when required keys are absent", () => {
    expect(parseSessionSummary('{"foo":1}')).toBeNull();
    expect(parseSessionSummary('{"topicsWorkedOn":["x"]}')).toBeNull();
  });

  it("parses a well-formed summary and normalises the effort enum", () => {
    const parsed = parseSessionSummary(JSON.stringify(clean));
    expect(parsed).toEqual(clean);

    const oddEffort = parseSessionSummary(JSON.stringify({ ...clean, effort: "SUPER-DUPER" }));
    expect(oddEffort?.effort).toBe("unclear");
  });

  it("tolerates a fenced ```json code block", () => {
    const fenced = ["```json", JSON.stringify(clean), "```"].join("\n");
    expect(parseSessionSummary(fenced)).toEqual(clean);
  });
});

describe("clampHelpfulness", () => {
  it("clamps to the -1 / 0 / +1 range and rounds", () => {
    expect(clampHelpfulness(5)).toBe(1);
    expect(clampHelpfulness(-9)).toBe(-1);
    expect(clampHelpfulness(1)).toBe(1);
    expect(clampHelpfulness(-1)).toBe(-1);
    expect(clampHelpfulness(0)).toBe(0);
    expect(clampHelpfulness(0.4)).toBe(0);
    expect(clampHelpfulness("1")).toBe(1);
  });

  it("returns null for absent / non-numeric input", () => {
    expect(clampHelpfulness(null)).toBeNull();
    expect(clampHelpfulness(undefined)).toBeNull();
    expect(clampHelpfulness("banana")).toBeNull();
  });
});

describe("leakage guard (de-personalisation contract)", () => {
  it("accepts a de-personalised summary about the material", () => {
    expect(checkLeakage(clean, transcript).ok).toBe(true);
  });

  it("rejects a summary that echoes a sensitive personal disclosure", () => {
    const leaky: SessionSummary = {
      ...clean,
      misconceptions: ["de student heeft last van faalangst en weinig zelfvertrouwen"],
    };
    const res = checkLeakage(leaky, transcript);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("disclosure");
  });

  it("rejects a summary that quotes the transcript verbatim", () => {
    const leaky: SessionSummary = {
      ...clean,
      topicsWorkedOn: ["De buitenste functie is de sinus, denk ik"],
    };
    const res = checkLeakage(leaky, transcript);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("quote");
  });

  it("validateSummaryOutput returns the summary only when clean", () => {
    expect(validateSummaryOutput(JSON.stringify(clean), transcript)).toEqual(clean);
    expect(
      validateSummaryOutput(
        JSON.stringify({ ...clean, misconceptions: ["last van faalangst thuis"] }),
        transcript,
      ),
    ).toBeNull();
    expect(validateSummaryOutput("garbage", transcript)).toBeNull();
  });
});

describe("summariseSession orchestration", () => {
  it("retries once on malformed model output, then returns the valid parse", async () => {
    const complete = vi
      .fn()
      .mockResolvedValueOnce("not json at all")
      .mockResolvedValueOnce(JSON.stringify(clean));
    const result = await summariseSession({
      transcript,
      outputLanguage: "nl",
      complete,
    });
    expect(result).toEqual(clean);
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("gives up (returns null) after a second bad output — no partial leak", async () => {
    const complete = vi
      .fn()
      .mockResolvedValue(
        JSON.stringify({ ...clean, misconceptions: ["heeft last van faalangst"] }),
      );
    const result = await summariseSession({
      transcript,
      outputLanguage: "nl",
      complete,
    });
    expect(result).toBeNull();
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("passes the transcript into the built system prompt as delimited material", async () => {
    const complete = vi.fn().mockResolvedValue(JSON.stringify(clean));
    await summariseSession({ transcript, outputLanguage: "nl", complete });
    const { system } = complete.mock.calls[0][0];
    expect(system).toContain("faalangst"); // the transcript is embedded for the model
    expect(system.length).toBeGreaterThan(transcript.length);
  });
});
