import { describe, expect, it } from "vitest";
import * as edit from "~/lib/portfolio/edit";
import {
  citationsIn,
  READINESS_CODES,
  type ReadinessCode,
  type ReadinessItem,
  readinessCheck,
  readinessSummary,
} from "~/lib/portfolio/readiness";
import { emptyDossier } from "~/lib/portfolio/schema";
import type { DossierData } from "~/lib/portfolio/types";
import { C1, C2, EV, LU, sampleDossier } from "./fixtures";

const NOW = Date.UTC(2026, 10, 5);

/** The sample dossier with every check green (no ticks needed except "no names"). */
function tidy(): DossierData {
  let d = sampleDossier();
  d = edit.updateOutcome(d, LU, { requiredEvidence: ["Feedback van de werkplekbegeleider"] });
  d = edit.setStatus(d, C2, "shown");
  d = edit.updateEvidence(d, EV, { criterionIds: [C1, C2] });
  // Last: any framework edit clears the confirmation.
  d = edit.confirmFramework(d, NOW);
  return { ...d, readiness: { ticked: { "no-student-names": NOW } } };
}

const of = (items: ReadinessItem[], code: ReadinessCode) => items.filter((i) => i.code === code);
const levelOf = (items: ReadinessItem[], code: ReadinessCode) =>
  of(items, code).map((i) => i.level);

describe("readinessCheck — a tidy dossier", () => {
  it("is all green and every item that applies is listed once", () => {
    const items = readinessCheck(tidy());
    expect(items.every((i) => i.level === "ok")).toBe(true);
    expect(readinessSummary(items)).toEqual({ open: 0, blocking: 0 });
    // Requirements this framework does not ask for are not checked.
    expect(of(items, "min-constructed-items")).toEqual([]);
    expect(of(items, "min-analysed-items")).toEqual([]);
    expect(of(items, "ai-disclosure-missing")).toEqual([]);
    // Lists follow the fixed code order.
    const order = items.map((i) => READINESS_CODES.indexOf(i.code));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("gives an empty dossier only the framework and the self-check", () => {
    const items = readinessCheck(emptyDossier(["bdb"]));
    expect(items.map((i) => [i.code, i.level])).toEqual([
      ["framework-unconfirmed", "block"],
      ["no-student-names", "warn"],
    ]);
  });
});

describe("readinessCheck — one code at a time", () => {
  it("framework-unconfirmed: block until confirmed, with a fix on the framework page", () => {
    const d = { ...tidy(), framework: { ...tidy().framework, confirmedAt: undefined } };
    expect(of(readinessCheck(d), "framework-unconfirmed")).toEqual([
      { code: "framework-unconfirmed", level: "block", fix: { to: "framework" } },
    ]);
    expect(levelOf(readinessCheck(tidy()), "framework-unconfirmed")).toEqual(["ok"]);
  });

  it("criterion-unverified: warn per criterion the extraction flagged", () => {
    const d = tidy();
    d.framework.outcomes[0].criteria[1].unverified = true;
    expect(of(readinessCheck(d), "criterion-unverified")).toEqual([
      {
        code: "criterion-unverified",
        level: "warn",
        outcomeId: LU,
        criterionId: C2,
        fix: { to: "framework" },
      },
    ]);
  });

  it("criterion-without-evidence: block per criterion with no linked evidence", () => {
    const d = edit.updateEvidence(tidy(), EV, { criterionIds: [C1] });
    expect(of(readinessCheck(d), "criterion-without-evidence")).toEqual([
      {
        code: "criterion-without-evidence",
        level: "block",
        outcomeId: LU,
        criterionId: C2,
        fix: { to: "evidence", outcomeId: LU },
      },
    ]);
  });

  it("required-evidence-missing: block per required line without matching evidence", () => {
    const d = edit.updateOutcome(tidy(), LU, {
      requiredEvidence: ["Feedback van de werkplekbegeleider", "Opname van de les"],
    });
    expect(of(readinessCheck(d), "required-evidence-missing")).toEqual([
      {
        code: "required-evidence-missing",
        level: "block",
        outcomeId: LU,
        detail: "Opname van de les",
        fix: { to: "evidence", outcomeId: LU },
      },
    ]);
    // A framework that asks for no evidence lines gets no finding for it at all.
    const none = edit.updateOutcome(tidy(), LU, { requiredEvidence: [] });
    expect(of(readinessCheck(none), "required-evidence-missing")).toEqual([]);
  });

  it("chapter-empty: block for an outcome with criteria and no or an empty chapter", () => {
    const d = edit.writeChapter(tidy(), LU, "   ");
    expect(of(readinessCheck(d), "chapter-empty")).toEqual([
      {
        code: "chapter-empty",
        level: "block",
        outcomeId: LU,
        fix: { to: "chapter", outcomeId: LU },
      },
    ]);
    const gone = { ...tidy(), chapters: [] };
    expect(levelOf(readinessCheck(gone), "chapter-empty")).toEqual(["block"]);
  });

  it("criterion-not-shown: warn per criterion the teacher has not marked as shown", () => {
    const d = edit.setStatus(tidy(), C2, "in-progress");
    expect(of(readinessCheck(d), "criterion-not-shown")).toEqual([
      {
        code: "criterion-not-shown",
        level: "warn",
        outcomeId: LU,
        criterionId: C2,
        fix: { to: "criterion", outcomeId: LU, criterionId: C2 },
      },
    ]);
  });

  it("over-word-limit: block above maxWords, pointing at the longest chapter", () => {
    const long = Array.from({ length: 120 }, () => "woord").join(" ");
    const d = edit.writeChapter(tidy(), LU, long);
    expect(of(readinessCheck(d), "over-word-limit")).toEqual([
      {
        code: "over-word-limit",
        level: "block",
        count: 120,
        limit: 100,
        fix: { to: "chapter", outcomeId: LU },
      },
    ]);
    const noLimit = tidy();
    noLimit.framework.requirements = {};
    expect(of(readinessCheck(noLimit), "over-word-limit")).toEqual([]);
  });

  it("citation-not-in-references: warn per citation the reference list lacks; gone once added", () => {
    const d = edit.writeChapter(tidy(), LU, "Ik ontwierp de toets volgens (Biggs, 2011).");
    expect(of(readinessCheck(d), "citation-not-in-references")).toEqual([
      {
        code: "citation-not-in-references",
        level: "warn",
        outcomeId: LU,
        detail: "Biggs, 2011",
        fix: { to: "references" },
      },
    ]);
    const fixed = edit.addReference(
      d,
      "Biggs, J., & Tang, C. (2011). Teaching for quality learning at university (4th ed.). Open University Press.",
    );
    expect(levelOf(readinessCheck(fixed), "citation-not-in-references")).toEqual(["ok"]);
  });

  it("reference-not-cited: warn per reference no chapter cites", () => {
    const d = edit.addReference(tidy(), "Hattie, J. (2009). Visible learning. Routledge.");
    const items = of(readinessCheck(d), "reference-not-cited");
    expect(items).toMatchObject([
      {
        level: "warn",
        detail: "Hattie, J. (2009). Visible learning. Routledge.",
        fix: { to: "references" },
      },
    ]);
    const cited = edit.writeChapter(d, LU, "Feedback werkt (Hattie, 2009).");
    expect(levelOf(readinessCheck(cited), "reference-not-cited")).toEqual(["ok"]);
  });

  it("reference-not-cited: no alarm for a reference it cannot read", () => {
    const d = edit.addReference(tidy(), "Eigen aantekeningen, zonder jaartal");
    expect(of(readinessCheck(d), "reference-not-cited").map((i) => i.level)).toEqual(["ok"]);
  });

  it("ai-disclosure-missing: only when the form asks for it and AI was used; ticking clears it", () => {
    const d = tidy();
    d.framework.requirements.aiDisclosureRequired = true;
    expect(of(readinessCheck(d), "ai-disclosure-missing")).toEqual([]);
    d.aiLog = [{ at: NOW, action: "review", outcomeId: LU, model: "claude-sonnet-5-5" }];
    expect(of(readinessCheck(d), "ai-disclosure-missing")).toEqual([
      { code: "ai-disclosure-missing", level: "block", tick: true, fix: { to: "export" } },
    ]);
    const ticked = { ...d, readiness: { ticked: { "ai-disclosure-missing": NOW } } };
    expect(of(readinessCheck(ticked), "ai-disclosure-missing")).toEqual([
      {
        code: "ai-disclosure-missing",
        level: "ok",
        tick: true,
        tickedAt: NOW,
        fix: { to: "export" },
      },
    ]);
  });

  it("min-constructed-items: counts the questions of linked test snapshots", () => {
    const d = tidy();
    d.framework.requirements.minConstructedItems = 10;
    expect(of(readinessCheck(d), "min-constructed-items")).toEqual([
      {
        code: "min-constructed-items",
        level: "warn",
        tick: true,
        count: 0,
        limit: 10,
        fix: { to: "evidence", outcomeId: LU },
      },
    ]);
    const snapshot = (n: number, id: string) => ({
      id,
      title: `Toets ${id}`,
      kind: "test-material" as const,
      text: "",
      criterionIds: [C1],
      sourceCourse: {
        courseId: "course-1",
        part: { assessmentId: `a-${id}` },
        at: NOW,
        itemCount: n,
      },
    });
    const counted = { ...d, evidence: [...d.evidence, snapshot(6, "t1"), snapshot(4, "t2")] };
    expect(of(readinessCheck(counted), "min-constructed-items")).toMatchObject([
      { level: "ok", count: 10, limit: 10 },
    ]);
    const ticked = {
      ...d,
      readiness: { ticked: { ...d.readiness?.ticked, "min-constructed-items": NOW } },
    };
    expect(of(readinessCheck(ticked), "min-constructed-items")).toMatchObject([
      { level: "ok", tickedAt: NOW },
    ]);
  });

  it("min-analysed-items: a self-check when the form sets it", () => {
    const d = tidy();
    d.framework.requirements.minAnalysedItems = 5;
    expect(of(readinessCheck(d), "min-analysed-items")).toMatchObject([
      { level: "warn", tick: true, limit: 5 },
    ]);
    const ticked = { ...d, readiness: { ticked: { "min-analysed-items": NOW } } };
    expect(levelOf(readinessCheck(ticked), "min-analysed-items")).toEqual(["ok"]);
  });

  it("no-student-names: always a self-check, ok with the date once ticked", () => {
    const d = { ...tidy(), readiness: undefined };
    expect(of(readinessCheck(d), "no-student-names")).toEqual([
      { code: "no-student-names", level: "warn", tick: true },
    ]);
    expect(of(readinessCheck(tidy()), "no-student-names")).toEqual([
      { code: "no-student-names", level: "ok", tick: true, tickedAt: NOW },
    ]);
  });

  it("open-spot: block per marker left in a chapter or in evidence, with a fix where it is", () => {
    expect(levelOf(readinessCheck(tidy()), "open-spot")).toEqual(["ok"]);
    const d = edit.writeChapter(tidy(), LU, "Mijn les. [aanvullen: het effect] TODO");
    expect(of(readinessCheck(d), "open-spot")).toEqual([
      {
        code: "open-spot",
        level: "block",
        outcomeId: LU,
        detail: "[aanvullen: het effect]",
        fix: { to: "chapter", outcomeId: LU },
      },
      {
        code: "open-spot",
        level: "block",
        outcomeId: LU,
        detail: "TODO",
        fix: { to: "chapter", outcomeId: LU },
      },
    ]);
    const inEvidence = edit.updateEvidence(tidy(), EV, { text: "Datum: [invullen]" });
    expect(of(readinessCheck(inEvidence), "open-spot")).toEqual([
      {
        code: "open-spot",
        level: "block",
        outcomeId: LU,
        detail: "[invullen]",
        fix: { to: "evidence", outcomeId: LU },
      },
    ]);
  });

  it("evidence-pending: block per evidence item without text, named by its title", () => {
    expect(levelOf(readinessCheck(tidy()), "evidence-pending")).toEqual(["ok"]);
    const d = edit.updateEvidence(tidy(), EV, { text: "" });
    expect(of(readinessCheck(d), "evidence-pending")).toEqual([
      {
        code: "evidence-pending",
        level: "block",
        outcomeId: LU,
        detail: "Feedback werkplekbegeleider",
        fix: { to: "evidence", outcomeId: LU },
      },
    ]);
  });

  it("ignores a tick for a code that is not a self-check", () => {
    const d = edit.updateEvidence(tidy(), EV, { criterionIds: [C1] });
    const ticked = { ...d, readiness: { ticked: { "criterion-without-evidence": NOW } } };
    expect(levelOf(readinessCheck(ticked), "criterion-without-evidence")).toEqual(["block"]);
  });
});

describe("readinessSummary", () => {
  it("counts open points and how many of them block", () => {
    let d = edit.updateEvidence(tidy(), EV, { criterionIds: [C1] });
    d = edit.setStatus(d, C2, "in-progress");
    expect(readinessSummary(readinessCheck(d))).toEqual({ open: 2, blocking: 1 });
  });
});

describe("citationsIn", () => {
  const found = (text: string) => citationsIn(text).map((c) => `${c.surname} ${c.year}`);

  it("finds parenthetical and narrative citations", () => {
    expect(found("Zo blijkt (Biggs, 2011).")).toEqual(["Biggs 2011"]);
    expect(found("Volgens Biggs (2011) is dat zo.")).toEqual(["Biggs 2011"]);
    expect(found("(Biggs, 2011, p. 45)")).toEqual(["Biggs 2011"]);
  });

  it("handles e.a., et al., two authors and several citations in one bracket", () => {
    expect(found("(Hattie e.a., 2009)")).toEqual(["Hattie 2009"]);
    expect(found("Hattie et al. (2009) zeggen")).toEqual(["Hattie 2009"]);
    expect(found("(Biggs & Tang, 2011)")).toEqual(["Biggs 2011"]);
    expect(found("Biggs en Tang (2011) beschrijven")).toEqual(["Biggs 2011"]);
    expect(found("(Biggs, 2011; Hattie, 2009)")).toEqual(["Biggs 2011", "Hattie 2009"]);
  });

  it("keeps Dutch name prefixes out of the surname", () => {
    expect(found("Volgens van den Akker (2003) is dat zo.")).toEqual(["Akker 2003"]);
  });

  it("raises no false alarm on years in ordinary sentences", () => {
    expect(found("In 2024 begon ik als docent.")).toEqual([]);
    expect(found("Dat was in het studiejaar (2024-2025) lastig.")).toEqual([]);
    expect(found("Sinds september (2024) geef ik les.")).toEqual([]);
    expect(found("In (2024) begon ik.")).toEqual([]);
  });

  it("lists a citation once", () => {
    expect(found("(Biggs, 2011) en later weer (Biggs, 2011)")).toEqual(["Biggs 2011"]);
  });
});
