import { describe, expect, it } from "vitest";
import { parseAgentReview } from "~/lib/agents/filter";
import { AGENT_LIMITS } from "~/lib/agents/schema";
import { LO1, LO2, TEST1, alignedCourse } from "../courses/fixtures";

const course = alignedCourse();

function answer(findings: unknown[]): string {
  return `Hier is mijn oordeel:\n\`\`\`json\n${JSON.stringify({ findings })}\n\`\`\``;
}

describe("parseAgentReview (P21.1)", () => {
  it("maps short keys back to real ids", () => {
    const r = parseAgentReview(
      answer([
        { severity: "warning", target: "L1", message: "Te breed.", suggestion: "Splits hem." },
        { severity: "info", target: "T2", message: "Weging klopt.", suggestion: "Niets." },
      ]),
      course,
      [],
    );
    expect(r).toEqual({
      ok: true,
      findings: [
        { severity: "warning", targetId: LO1, message: "Te breed.", suggestion: "Splits hem." },
        { severity: "info", targetId: TEST1, message: "Weging klopt.", suggestion: "Niets." },
      ],
    });
  });

  it("keeps a course-wide finding without a target", () => {
    const r = parseAgentReview(
      answer([{ severity: "info", message: "Veel hoorcolleges.", suggestion: "Activeer." }]),
      course,
      [],
    );
    expect(r.ok && r.findings[0]!.targetId).toBeUndefined();
  });

  it("drops a finding that points at an item that does not exist", () => {
    const r = parseAgentReview(
      answer([
        { severity: "warning", target: "L9", message: "Verzonnen.", suggestion: "x" },
        { severity: "warning", target: "L2", message: "Echt.", suggestion: "y" },
      ]),
      course,
      [],
    );
    expect(r.ok && r.findings.map((f) => f.message)).toEqual(["Echt."]);
  });

  it("drops duplicates and earlier rejected findings", () => {
    const r = parseAgentReview(
      answer([
        { severity: "warning", target: "L2", message: "Vaag  geformuleerd.", suggestion: "a" },
        { severity: "warning", target: "L2", message: "vaag geformuleerd.", suggestion: "b" },
        { severity: "info", target: "L1", message: "Al verworpen.", suggestion: "c" },
      ]),
      course,
      [{ targetId: LO1, message: "Al verworpen." }],
    );
    expect(r.ok && r.findings.map((f) => f.suggestion)).toEqual(["a"]);
  });

  it("drops an empty message and clips long text", () => {
    const long = "x".repeat(AGENT_LIMITS.message + 50);
    const r = parseAgentReview(
      answer([
        { severity: "info", message: "   ", suggestion: "a" },
        { severity: "info", message: long, suggestion: "b" },
      ]),
      course,
      [],
    );
    expect(r.ok && r.findings).toHaveLength(1);
    expect(r.ok && r.findings[0]!.message.length).toBeLessThanOrEqual(AGENT_LIMITS.message);
  });

  it("keeps at most the finding limit", () => {
    const many = Array.from({ length: AGENT_LIMITS.findings + 5 }, (_, i) => ({
      severity: "info",
      message: `Punt ${i}`,
      suggestion: "s",
    }));
    const r = parseAgentReview(answer(many), course, []);
    expect(r.ok && r.findings).toHaveLength(AGENT_LIMITS.findings);
  });

  it("reports an answer that is not the expected JSON", () => {
    expect(parseAgentReview("Ik vind het een prima cursus.", course, [])).toEqual({
      ok: false,
      error: "unparseable",
    });
    expect(parseAgentReview(answer([{ severity: "fatal", message: "x" }]), course, [])).toEqual({
      ok: false,
      error: "unparseable",
    });
  });

  it("returns no findings for an empty list", () => {
    expect(parseAgentReview(answer([]), course, [])).toEqual({ ok: true, findings: [] });
  });

  it("uses only the teacher's real ids, even with a matching rejected target", () => {
    const r = parseAgentReview(
      answer([{ severity: "info", target: "L2", message: "Nieuw punt.", suggestion: "s" }]),
      course,
      [{ targetId: LO2, message: "Ander punt." }],
    );
    expect(r.ok && r.findings).toHaveLength(1);
  });
});
