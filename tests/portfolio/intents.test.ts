import { describe, it, expect } from "vitest";
import { applyIntent } from "~/lib/portfolio/intents";
import { emptyDossier } from "~/lib/portfolio/schema";
import { C1, C2, CH, EV, LU, sampleDossier } from "./fixtures";

function fd(fields: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    for (const value of Array.isArray(v) ? v : [v]) f.append(k, value);
  }
  return f;
}

const ctx = { now: 1_000, locale: "nl" as const };

function ok(result: ReturnType<typeof applyIntent>) {
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
  return result.data;
}

describe("applyIntent — framework", () => {
  it("fills an empty framework with the public skeleton for the dossier's tracks", () => {
    const d = ok(applyIntent(emptyDossier(["bdb", "bke"]), fd({ intent: "useSkeleton" }), ctx));
    expect(d.framework.outcomes.map((o) => o.code)).toEqual([
      "BDB-1",
      "BDB-2",
      "BDB-3",
      "BDB-4",
      "BDB-5",
      "BKE-1",
      "BKE-2",
      "BKE-3",
    ]);
  });

  it("refuses the skeleton when the framework already has outcomes", () => {
    const r = applyIntent(sampleDossier(), fd({ intent: "useSkeleton" }), ctx);
    expect(r).toEqual({ ok: false, error: "invalid" });
  });

  it("saves institution, year and form requirements", () => {
    const d = ok(
      applyIntent(
        sampleDossier(),
        fd({
          intent: "meta",
          institution: " Hogeschool Y ",
          year: "2026",
          maxWords: "6000",
          minConstructedItems: "5",
          minAnalysedItems: "",
          aiDisclosureRequired: "on",
          notes: "Eén Word-bestand.",
        }),
        ctx,
      ),
    );
    expect(d.framework.institution).toBe("Hogeschool Y");
    expect(d.framework.year).toBe("2026");
    expect(d.framework.requirements).toEqual({
      maxWords: 6000,
      minConstructedItems: 5,
      aiDisclosureRequired: true,
      notes: "Eén Word-bestand.",
    });
  });

  it("rejects a non-numeric word limit", () => {
    const r = applyIntent(sampleDossier(), fd({ intent: "meta", maxWords: "veel" }), ctx);
    expect(r).toEqual({ ok: false, error: "invalid" });
  });

  it("adds, updates and removes an outcome", () => {
    let d = ok(
      applyIntent(
        sampleDossier(),
        fd({ intent: "addOutcome", code: "LU2", title: "Begeleiden" }),
        ctx,
      ),
    );
    const added = d.framework.outcomes[1];
    expect(added).toMatchObject({ code: "LU2", title: "Begeleiden", criteria: [] });
    d = ok(
      applyIntent(
        d,
        fd({
          intent: "updateOutcome",
          outcomeId: added.id,
          code: "LU2",
          title: "Studenten begeleiden",
          requiredEvidence: "Feedback van een student\n\n  Een verslag  \n",
        }),
        ctx,
      ),
    );
    expect(d.framework.outcomes[1].title).toBe("Studenten begeleiden");
    expect(d.framework.outcomes[1].requiredEvidence).toEqual([
      "Feedback van een student",
      "Een verslag",
    ]);
    d = ok(applyIntent(d, fd({ intent: "removeOutcome", outcomeId: added.id }), ctx));
    expect(d.framework.outcomes).toHaveLength(1);
  });

  it("requires a title for an outcome", () => {
    const r = applyIntent(
      sampleDossier(),
      fd({ intent: "addOutcome", code: "X", title: " " }),
      ctx,
    );
    expect(r).toEqual({ ok: false, error: "invalid" });
  });

  it("adds, updates and removes a criterion", () => {
    let d = ok(
      applyIntent(
        sampleDossier(),
        fd({ intent: "addCriterion", outcomeId: LU, text: "Nieuw criterium", strongLevel: "" }),
        ctx,
      ),
    );
    const c = d.framework.outcomes[0].criteria[2];
    expect(c.text).toBe("Nieuw criterium");
    expect(c).not.toHaveProperty("strongLevel");
    d = ok(
      applyIntent(
        d,
        fd({ intent: "updateCriterion", criterionId: c.id, text: "Beter", strongLevel: "Sterk" }),
        ctx,
      ),
    );
    expect(d.framework.outcomes[0].criteria[2]).toMatchObject({
      text: "Beter",
      strongLevel: "Sterk",
    });
    d = ok(applyIntent(d, fd({ intent: "removeCriterion", criterionId: c.id }), ctx));
    expect(d.framework.outcomes[0].criteria).toHaveLength(2);
  });

  it("reports an unknown id as not-found", () => {
    const r = applyIntent(
      sampleDossier(),
      fd({ intent: "addCriterion", outcomeId: "nope", text: "x" }),
      ctx,
    );
    expect(r).toEqual({ ok: false, error: "not-found" });
  });

  it("confirms the framework at the given time", () => {
    const d = ok(applyIntent(sampleDossier(), fd({ intent: "confirm" }), ctx));
    expect(d.framework.confirmedAt).toBe(1_000);
  });

  it("refuses to confirm a framework without criteria", () => {
    const r = applyIntent(emptyDossier(["bdb"]), fd({ intent: "confirm" }), ctx);
    expect(r).toEqual({ ok: false, error: "invalid" });
  });
});

describe("applyIntent — outcome work", () => {
  it("sets a criterion status chosen by the teacher", () => {
    const d = ok(
      applyIntent(
        sampleDossier(),
        fd({ intent: "setStatus", criterionId: C2, status: "in-progress" }),
        ctx,
      ),
    );
    expect(d.status[C2]).toBe("in-progress");
  });

  it("rejects an unknown status", () => {
    const r = applyIntent(
      sampleDossier(),
      fd({ intent: "setStatus", criterionId: C2, status: "perfect" }),
      ctx,
    );
    expect(r).toEqual({ ok: false, error: "invalid" });
  });

  it("adds evidence linked to criteria", () => {
    const d = ok(
      applyIntent(
        sampleDossier(),
        fd({
          intent: "addEvidence",
          outcomeId: LU,
          title: "Lesvoorbereiding week 3",
          kind: "lesson-plan",
          text: "Doelen: …",
          criterionIds: [C1, C2],
        }),
        ctx,
      ),
    );
    expect(d.evidence[1]).toMatchObject({
      title: "Lesvoorbereiding week 3",
      kind: "lesson-plan",
      criterionIds: [C1, C2],
    });
  });

  it("refuses evidence linked to a criterion of another outcome", () => {
    let d = ok(
      applyIntent(sampleDossier(), fd({ intent: "addOutcome", code: "LU2", title: "B" }), ctx),
    );
    const lu2 = d.framework.outcomes[1].id;
    d = ok(applyIntent(d, fd({ intent: "addCriterion", outcomeId: lu2, text: "x" }), ctx));
    const r = applyIntent(
      d,
      fd({ intent: "addEvidence", outcomeId: lu2, title: "t", kind: "other", criterionIds: [C1] }),
      ctx,
    );
    expect(r).toEqual({ ok: false, error: "invalid" });
  });

  it("updates evidence and keeps links to other outcomes' criteria", () => {
    let d = ok(
      applyIntent(sampleDossier(), fd({ intent: "addOutcome", code: "LU2", title: "B" }), ctx),
    );
    const lu2 = d.framework.outcomes[1].id;
    d = ok(applyIntent(d, fd({ intent: "addCriterion", outcomeId: lu2, text: "x" }), ctx));
    const c3 = d.framework.outcomes[1].criteria[0].id;
    // Link the evidence to LU2's criterion from the LU2 page.
    d = ok(
      applyIntent(
        d,
        fd({
          intent: "updateEvidence",
          outcomeId: lu2,
          evidenceId: EV,
          title: "Feedback werkplekbegeleider",
          kind: "feedback",
          text: "Goede opbouw.",
          criterionIds: [c3],
        }),
        ctx,
      ),
    );
    expect(d.evidence[0].criterionIds).toEqual([C1, c3]);
  });

  it("removes evidence", () => {
    const d = ok(
      applyIntent(sampleDossier(), fd({ intent: "removeEvidence", evidenceId: EV }), ctx),
    );
    expect(d.evidence).toEqual([]);
  });

  it("writes the chapter for an outcome", () => {
    const d = ok(
      applyIntent(
        sampleDossier(),
        fd({ intent: "writeChapter", outcomeId: LU, text: "Nieuwe tekst." }),
        ctx,
      ),
    );
    expect(d.chapters).toEqual([
      { id: CH, outcomeId: LU, text: "Nieuwe tekst.", aiDrafted: false },
    ]);
  });

  it("adds and removes a reference", () => {
    let d = ok(
      applyIntent(
        sampleDossier(),
        fd({ intent: "addReference", apa: "Last, B. (2017). Blended learning in de praktijk." }),
        ctx,
      ),
    );
    expect(d.references).toHaveLength(1);
    d = ok(applyIntent(d, fd({ intent: "removeReference", referenceId: d.references[0].id }), ctx));
    expect(d.references).toEqual([]);
  });

  it("rejects an unknown intent", () => {
    expect(applyIntent(sampleDossier(), fd({ intent: "hack" }), ctx)).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("rejects a result that breaks the dossier limits", () => {
    const r = applyIntent(
      sampleDossier(),
      fd({ intent: "addReference", apa: "x".repeat(501) }),
      ctx,
    );
    expect(r).toEqual({ ok: false, error: "invalid" });
  });
});

describe("applyIntent — absent optional fields", () => {
  it("treats absent form-requirement fields as not set", () => {
    const d = ok(applyIntent(sampleDossier(), fd({ intent: "meta" }), ctx));
    expect(d.framework.requirements).toEqual({});
  });

  it("treats an absent required-evidence field as no lines", () => {
    const d = ok(
      applyIntent(sampleDossier(), fd({ intent: "updateOutcome", outcomeId: LU, title: "T" }), ctx),
    );
    expect(d.framework.outcomes[0].requiredEvidence).toEqual([]);
  });
});

describe("applyIntent — coach settings", () => {
  it("switches between coaching and drafting, the teacher's choice", () => {
    const d = ok(applyIntent(sampleDossier(), fd({ intent: "coachMode", mode: "draft" }), ctx));
    expect(d.coachMode).toBe("draft");
    expect(ok(applyIntent(d, fd({ intent: "coachMode", mode: "coach" }), ctx)).coachMode).toBe(
      "coach",
    );
    expect(applyIntent(d, fd({ intent: "coachMode", mode: "auto" }), ctx)).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("remembers the first time the draft notice was dismissed", () => {
    const d = ok(applyIntent(sampleDossier(), fd({ intent: "dismissDraftNotice" }), ctx));
    expect(d.draftNoticeSeenAt).toBe(1_000);
    const again = ok(applyIntent(d, fd({ intent: "dismissDraftNotice" }), { ...ctx, now: 5_000 }));
    expect(again.draftNoticeSeenAt).toBe(1_000);
  });
});

describe("applyIntent — readiness self-checks (P29.1)", () => {
  it("ticks a self-check with the date, keeps the first date, and unticks", () => {
    const d = ok(
      applyIntent(
        sampleDossier(),
        fd({ intent: "tickReadiness", code: "no-student-names", ticked: "on" }),
        ctx,
      ),
    );
    expect(d.readiness?.ticked).toEqual({ "no-student-names": 1_000 });
    const again = ok(
      applyIntent(d, fd({ intent: "tickReadiness", code: "no-student-names", ticked: "on" }), {
        ...ctx,
        now: 5_000,
      }),
    );
    expect(again.readiness?.ticked).toEqual({ "no-student-names": 1_000 });
    const off = ok(
      applyIntent(again, fd({ intent: "tickReadiness", code: "no-student-names" }), ctx),
    );
    expect(off.readiness?.ticked).toEqual({});
  });

  it("refuses a code that is not a self-check", () => {
    for (const code of ["criterion-without-evidence", "anything", ""]) {
      expect(
        applyIntent(sampleDossier(), fd({ intent: "tickReadiness", code, ticked: "on" }), ctx),
      ).toEqual({ ok: false, error: "invalid" });
    }
  });
});

describe("applyIntent — back from Word", () => {
  it("takes over the chosen chapters and adds only new references", () => {
    const d = ok(
      applyIntent(
        sampleDossier(),
        fd({
          intent: "importChapters",
          chapters: JSON.stringify([{ outcomeId: LU, text: "Uit Word." }]),
          reference: ["Biggs, J. (2011). Teaching.", "Biggs, J. (2011). Teaching.", "  "],
        }),
        ctx,
      ),
    );
    expect(d.chapters).toEqual([{ id: CH, outcomeId: LU, text: "Uit Word.", aiDrafted: false }]);
    expect(d.references.map((r) => r.apa)).toEqual(["Biggs, J. (2011). Teaching."]);
  });

  it("refuses chapters that are not valid JSON, or for an outcome the dossier does not have", () => {
    for (const chapters of ["{", JSON.stringify([{ outcomeId: "nope", text: "x" }])]) {
      const r = applyIntent(sampleDossier(), fd({ intent: "importChapters", chapters }), ctx);
      expect(r.ok).toBe(false);
    }
  });
});
