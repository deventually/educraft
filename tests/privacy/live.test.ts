import { describe, expect, it } from "vitest";
import { gateTexts } from "~/lib/privacy/gate";
import {
  emptyNamed,
  livePreview,
  type LiveChoices,
  prepareSend,
  studentNumberShape,
} from "~/lib/privacy/live";
import { restoreNames } from "~/lib/privacy/redact";

/**
 * The live preview (anonymiseerpoort PR 3): while the teacher types, the browser runs the same
 * engine as the gate and shows what goes. Student names stay in the browser (they are replaced
 * there); the names the app knows and the patterns go to the gate with the teacher's approval,
 * so what LimeOnIt keeps has the real names again. Seams: `livePreview` and `prepareSend`.
 */
const known = { teacher: "Mark de Groot", colleagues: ["Fatima el Amrani", "Anna Visser"] };
const choices = (over: Partial<LiveChoices> = {}): LiveChoices => ({
  named: emptyNamed,
  keep: [],
  ...over,
});

describe("livePreview: what the teacher sees while typing", () => {
  it("marks known names, patterns and the names the teacher gave, each with its code", () => {
    const [field] = livePreview(
      [{ name: "q", text: "Fatima el Amrani mailt jan@school.nl over Jan de Vries." }],
      known,
      choices({ named: { ...emptyNamed, student: "Jan de Vries" } }),
    );
    expect(field?.spans.map((s) => [s.original, s.code, s.kind])).toEqual([
      ["Fatima el Amrani", "COLLEGA-1", "known"],
      ["jan@school.nl", "E-MAIL-1", "pattern"],
      ["Jan de Vries", "STUDENT", "named"],
    ]);
  });

  it("shows a word the teacher keeps as kept, so one click turns it back on", () => {
    const [field] = livePreview(
      [{ name: "q", text: "Volgens Visser en Anna Visser." }],
      known,
      choices({ keep: ["visser"] }),
    );
    expect(field?.spans.map((s) => [s.original, s.kept])).toEqual([
      ["Visser", true],
      ["Anna Visser", false],
    ]);
  });

  it("gives one value one code across all fields", () => {
    const fields = livePreview(
      [
        { name: "a", text: "Bel 0612345678." },
        { name: "b", text: "Of 0687654321, of 0612345678." },
      ],
      known,
      choices(),
    );
    expect(fields.map((f) => f.spans.map((s) => s.code))).toEqual([
      ["TELEFOON-1"],
      ["TELEFOON-2", "TELEFOON-1"],
    ]);
  });
});

describe("prepareSend: what leaves the browser", () => {
  const named = { ...emptyNamed, student: "Jan de Vries", studentNumber: "s1234567" };

  it("replaces the teacher's names in the browser and leaves known names for the gate", () => {
    const r = prepareSend(
      { fields: [{ name: "q", text: "Jan de Vries (s1234567) sprak Fatima el Amrani." }] },
      known,
      choices({ named }),
    );
    expect(r.values.q).toBe("[STUDENT] ([STUDENTNUMMER]) sprak Fatima el Amrani.");
    expect(r.approval.approved).toEqual(["Fatima el Amrani"]);
    expect(JSON.stringify(r.approval)).not.toMatch(/Vries|1234567/);
    expect(restoreNames("Goed, [STUDENT].", r.codes)).toBe("Goed, Jan de Vries.");
  });

  it("replaces everything in student work, so the original never reaches the server", () => {
    const r = prepareSend(
      {
        fields: [
          { name: "doc", text: "Fatima el Amrani, 0612345678, Jan de Vries.", redact: true },
        ],
      },
      known,
      choices({ named }),
    );
    expect(r.values.doc).toBe("[COLLEGA-1], [TELEFOON-1], [STUDENT].");
    expect(r.approval.approved).toEqual([]);
  });

  it("leaves kept words alone and tells the gate to keep them too", () => {
    const r = prepareSend(
      { fields: [{ name: "q", text: "Volgens Visser." }] },
      known,
      choices({ keep: ["Visser"] }),
    );
    expect(r.values.q).toBe("Volgens Visser.");
    expect(r.approval).toMatchObject({ approved: [], keep: ["Visser"] });
  });

  it("codes the conversation and earlier steps too, approving the names they show", () => {
    const r = prepareSend(
      {
        fields: [{ name: "q", text: "Verder." }],
        others: ["Jan de Vries werkt met Mark de Groot.", "[STUDENT] is klaar."],
      },
      known,
      choices({ named }),
    );
    expect(r.others).toEqual(["[STUDENT] werkt met Mark de Groot.", "[STUDENT] is klaar."]);
    expect(r.approval.approved).toEqual(["Mark de Groot"]);
  });

  it("adds what the teacher approved after the gate asked", () => {
    const r = prepareSend({ fields: [] }, known, choices({ approved: ["Piet Klaassen"] }));
    expect(r.approval.approved).toEqual(["Piet Klaassen"]);
  });

  it("sends the shape of the student number, never the number itself", () => {
    expect(studentNumberShape("s1234567")).toBe("s0000000");
    expect(studentNumberShape("12345678")).toBe("00000000");
    expect(studentNumberShape("")).toBeUndefined();
    const r = prepareSend({ fields: [] }, known, choices({ named }));
    expect(r.approval.studentNumberExample).toBe("s0000000");
  });

  it("is enough for the gate: what the preview showed goes without asking", () => {
    const text = "Fatima el Amrani mailt fatima@school.nl.";
    const r = prepareSend({ fields: [{ name: "q", text }] }, known, choices());
    const gated = gateTexts([r.values.q ?? ""], { known, mode: "review", ...r.approval });
    expect(gated.send && gated.texts).toEqual(["[COLLEGA-1] mailt [E-MAIL-1]."]);
  });
});
