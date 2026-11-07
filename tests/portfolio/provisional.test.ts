import { describe, expect, it } from "vitest";
import { applyIntent } from "~/lib/portfolio/intents";
import * as edit from "~/lib/portfolio/edit";
import { buildCoachMessage } from "~/lib/portfolio/coach";
import { applyExtraction } from "~/lib/portfolio/extract";
import { buildDossierDocx, OpenSpotsError } from "~/lib/portfolio/export";
import { openSpots } from "~/lib/portfolio/openSpots";
import { readinessCheck } from "~/lib/portfolio/readiness";
import { addRehearsalFeedback, buildRehearsalContext } from "~/lib/portfolio/rehearsal";
import { DossierDataSchema, emptyDossier } from "~/lib/portfolio/schema";
import type { DossierData } from "~/lib/portfolio/types";
import { LU, sampleDossier } from "./fixtures";

/**
 * A provisional framework (BDB/BKE plan, PR 3): the national starting point can be confirmed
 * as provisional, so the teacher can write and get feedback while waiting for the form of their
 * own institution. Every verdict then says it was made on the national starting point.
 */
const ctx = { now: 1_000, locale: "nl" as const };

function intent(d: DossierData, name: string): ReturnType<typeof applyIntent> {
  const f = new FormData();
  f.append("intent", name);
  return applyIntent(d, f, ctx);
}

function ok(r: ReturnType<typeof applyIntent>): DossierData {
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

const national = () => ok(intent(emptyDossier(["bdb"]), "useSkeleton"));

describe("provisional framework", () => {
  it("marks a framework built from the national starting point", () => {
    expect(national().framework.national).toBe(true);
    expect(sampleDossier().framework.national).toBeUndefined();
  });

  it("confirms the national starting point as provisional", () => {
    const d = ok(intent(national(), "confirmProvisional"));
    expect(d.framework.confirmedAt).toBe(1_000);
    expect(d.framework.provisional).toBe(true);
    expect(DossierDataSchema.safeParse(d).success).toBe(true);
  });

  it("refuses a provisional confirmation for the institution's own form", () => {
    expect(intent(sampleDossier(), "confirmProvisional")).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("a normal confirmation ends the provisional state", () => {
    const d = ok(intent(ok(intent(national(), "confirmProvisional")), "confirm"));
    expect(d.framework.confirmedAt).toBe(1_000);
    expect(d.framework.provisional).toBeUndefined();
  });

  it("an edit un-confirms a provisional framework too", () => {
    const d = ok(intent(national(), "confirmProvisional"));
    const outcomeId = d.framework.outcomes[0].id;
    const next = edit.addCriterion(d, outcomeId, { text: "Extra criterium uit mijn formulier." });
    expect(next.framework.confirmedAt).toBeUndefined();
    expect(next.framework.provisional).toBeUndefined();
    // Still built on the national starting point.
    expect(next.framework.national).toBe(true);
  });

  it("reading the institution's form replaces the national starting point", () => {
    const r = applyExtraction(national(), sampleDossier().framework);
    if (!r.ok) throw new Error(r.error);
    expect(r.data.framework.national).toBeUndefined();
  });

  for (const locale of ["nl", "en"] as const) {
    it(`tells the coach the framework is the national starting point (${locale})`, () => {
      const d = sampleDossier();
      d.framework = { ...d.framework, confirmedAt: 1, provisional: true, national: true };
      const message = buildCoachMessage(d, LU, locale);
      expect(message).toContain(
        locale === "nl"
          ? "Voorlopig kader: het landelijke startpunt, niet het formulier van de hogeschool."
          : "Provisional framework: the national starting point, not the institution's form.",
      );
      expect(buildCoachMessage(sampleDossier(), LU, locale)).not.toContain(
        locale === "nl" ? "Voorlopig kader" : "Provisional framework",
      );
    });
  }
});

describe("provisional framework in the rehearsal", () => {
  const provisional = (): DossierData => {
    const d = sampleDossier();
    d.framework = { ...d.framework, confirmedAt: 1, national: true, provisional: true };
    return d;
  };

  it("tells the committee the framework is the national starting point", () => {
    const { values } = buildRehearsalContext(provisional(), { length: "short", locale: "nl" });
    expect(values.framework).toContain(
      "Voorlopig kader: het landelijke startpunt, niet het formulier van de hogeschool.",
    );
    expect(
      buildRehearsalContext(sampleDossier(), { length: "short", locale: "nl" }).values.framework,
    ).not.toContain("Voorlopig kader");
  });

  it("labels kept feedback as given on the national starting point", () => {
    const feedback = { criteria: [], overall: "Helder." };
    const opts = {
      at: 1,
      model: "m",
      locale: "nl" as const,
      id: "00000000-0000-4000-8000-0000000000f1",
    };
    const kept = addRehearsalFeedback(provisional(), feedback, opts).evidence.at(-1)!;
    expect(kept.text).toContain("Op het landelijke startpunt (voorlopig kader).");
    const own = addRehearsalFeedback(sampleDossier(), feedback, opts).evidence.at(-1)!;
    expect(own.text).not.toContain("landelijke startpunt");
  });
});

describe("provisional framework at hand-in time (BESLUIT-2026-11-07-5)", () => {
  const provisional = (): DossierData => {
    const d = sampleDossier();
    d.framework = { ...d.framework, confirmedAt: 1, national: true, provisional: true };
    return d;
  };

  it("is an open spot: the final export waits, the draft version works", async () => {
    expect(openSpots(provisional())).toContainEqual({
      kind: "provisional",
      where: "framework",
      text: "",
    });
    expect(openSpots(sampleDossier()).some((s) => s.kind === "provisional")).toBe(false);
    const input = { name: "Mijn BDB", data: provisional(), locale: "nl" as const, now: 1 };
    await expect(buildDossierDocx(input)).rejects.toBeInstanceOf(OpenSpotsError);
    expect((await buildDossierDocx({ ...input, draft: true })).byteLength).toBeGreaterThan(0);
  });

  it("is a red point in the check, fixed on the framework page", () => {
    expect(readinessCheck(provisional()).filter((i) => i.code === "framework-provisional")).toEqual(
      [{ code: "framework-provisional", level: "block", fix: { to: "framework" } }],
    );
    expect(readinessCheck(sampleDossier()).some((i) => i.code === "framework-provisional")).toBe(
      false,
    );
  });
});
