import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type AgentCase,
  agentReportMarkdown,
  scoreAgentCase,
  selectAgentCases,
  unknownTargets,
} from "../../scripts/eval-agents-helpers";
import { AGENTS, getAgent } from "~/lib/agents/registry";
import { CourseDataSchema } from "~/lib/courses/schema";

const cases = JSON.parse(
  readFileSync(join(process.cwd(), "evals", "role-agents", "cases.json"), "utf8"),
).cases as AgentCase[];

function itemIds(c: AgentCase): Set<string> {
  const d = c.course;
  return new Set([...d.outcomes, ...d.activities, ...d.assessments].map((i) => i.id));
}

describe("role-agent eval cases (P21.2)", () => {
  it("covers every reviewer: two known faults and a clean course each, plus an injection", () => {
    for (const { id: agent } of AGENTS) {
      const mine = cases.filter((c) => c.agent === agent);
      expect(mine.filter((c) => c.mustFind?.length).length).toBeGreaterThanOrEqual(2);
      expect(mine.some((c) => c.maxWarnings === 0)).toBe(true);
    }
    expect(cases.some((c) => c.id.includes("injection"))).toBe(true);
    expect(cases.some((c) => c.rejected?.length && c.mustNotFind?.length)).toBe(true);
  });

  for (const c of cases) {
    it(`${c.id}: valid course, known hat, expected targets exist`, () => {
      expect(getAgent(c.agent)).toBeDefined();
      expect(CourseDataSchema.safeParse(c.course).success).toBe(true);
      const ids = itemIds(c);
      for (const e of [...(c.mustFind ?? []), ...(c.mustNotFind ?? [])])
        for (const t of e.targets ?? []) expect(ids.has(t), t).toBe(true);
    });
  }
});

const base: AgentCase = {
  id: "x",
  agent: "designer",
  locale: "nl",
  course: {
    outcomes: [{ id: "lo1", text: "Je ontwerpt een app.", bloom: "create" }],
    activities: [{ id: "a1", title: "Hoorcollege", kind: "lesson", outcomeIds: ["lo1"] }],
    assessments: [],
  },
  mustFind: [{ targets: ["lo1", "a1"], anyOf: ["oefen", "opdracht"] }],
  mustNotFind: [{ targets: ["lo1"], anyOf: ["vaag"] }],
  maxWarnings: 2,
};

describe("scoreAgentCase", () => {
  it("passes when the known fault is found and nothing forbidden is said", () => {
    const s = scoreAgentCase(
      base,
      {
        ok: true,
        findings: [
          {
            severity: "warning",
            targetId: "a1",
            message: "Alleen luisteren.",
            suggestion: "Voeg een opdracht toe.",
          },
        ],
      },
      0,
    );
    expect(s).toMatchObject({ parse: true, found: 1, forbidden: 0, warnings: 1, pass: true });
  });

  it("fails on a missed fault, a forbidden finding, too many warnings or an unknown target", () => {
    const vague = {
      severity: "warning" as const,
      targetId: "lo1",
      message: "Vaag.",
      suggestion: "x",
    };
    expect(scoreAgentCase(base, { ok: true, findings: [] }, 0).pass).toBe(false);
    expect(scoreAgentCase(base, { ok: true, findings: [vague] }, 0).forbidden).toBe(1);
    const many = Array.from({ length: 3 }, () => ({ ...vague, message: "Oefen meer." }));
    expect(scoreAgentCase(base, { ok: true, findings: many }, 0).pass).toBe(false);
    const good = { severity: "info" as const, targetId: "a1", message: "Oefen.", suggestion: "" };
    expect(scoreAgentCase(base, { ok: true, findings: [good] }, 1).pass).toBe(false);
  });

  it("fails an unparseable answer", () => {
    expect(scoreAgentCase(base, { ok: false, error: "unparseable" }, 0)).toMatchObject({
      parse: false,
      pass: false,
    });
  });
});

describe("unknownTargets", () => {
  it("counts keys in the raw answer the course does not have", () => {
    const raw = JSON.stringify({
      findings: [
        { severity: "info", target: "L1", message: "a" },
        { severity: "info", target: "L7", message: "b" },
        { severity: "info", message: "c" },
      ],
    });
    expect(unknownTargets(raw, base.course)).toBe(1);
  });
});

describe("agentReportMarkdown", () => {
  it("writes one row per case and the pass count", () => {
    const md = agentReportMarkdown({
      date: "2026-11-05",
      model: "m",
      repeat: 1,
      rows: [
        {
          caseId: "x",
          agent: "designer",
          parse: true,
          found: 1,
          forbidden: 0,
          warnings: 1,
          unknownTargets: 0,
          pass: true,
        },
      ],
    });
    expect(md).toContain("| x | designer |");
    expect(md).toContain("Geslaagd: 1 van 1.");
  });
});

describe("selecting role-agent eval cases", () => {
  const cases = [
    { id: "a1", agent: "student" },
    { id: "a2", agent: "designer" },
    { id: "a3", agent: "student" },
  ] as AgentCase[];
  const ids = (filter: { caseId?: string; agent?: string }) =>
    selectAgentCases(cases, filter).map((c) => c.id);

  it("runs every case without a filter, so a full run stays a regression test", () => {
    expect(ids({})).toEqual(["a1", "a2", "a3"]);
  });

  it("runs only one reviewer's cases with --agent, or one case with --case", () => {
    expect(ids({ agent: "student" })).toEqual(["a1", "a3"]);
    expect(ids({ caseId: "a2" })).toEqual(["a2"]);
    expect(ids({ agent: "student", caseId: "a2" })).toEqual([]);
  });

  it("refuses a reviewer that does not exist instead of running nothing", () => {
    expect(() => selectAgentCases(cases, { agent: "nope" })).toThrow(/nope/);
  });
});
