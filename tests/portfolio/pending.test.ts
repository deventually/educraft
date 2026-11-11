import { describe, expect, it } from "vitest";
import { buildCoachMessage } from "~/lib/portfolio/coach";
import { buildSectionDraftMessage } from "~/lib/portfolio/guided";
import { evidencePending } from "~/lib/portfolio/evidence";
import { buildRehearsalContext } from "~/lib/portfolio/rehearsal";
import type { DossierData } from "~/lib/portfolio/types";
import { C1, LU, sampleDossier } from "./fixtures";

/**
 * Evidence without text is "Volgt nog" (BDB/BKE plan, PR 3): a video, an observation report or
 * feedback that is still to come. It never counts as evidence, and the AI knows it is coming.
 */
function withPending(): DossierData {
  const d = sampleDossier();
  d.evidence = [{ ...d.evidence[0]!, title: "Video van de les", text: "  " }];
  return d;
}

describe("evidence that is still to come", () => {
  it("is evidence without text", () => {
    expect(evidencePending({ text: "" })).toBe(true);
    expect(evidencePending({ text: " \n " })).toBe(true);
    expect(evidencePending({ text: "Goede opbouw." })).toBe(false);
  });

  for (const [locale, label] of [
    ["nl", "(Volgt nog: hier is nog geen tekst. Telt nog niet als bewijs.)"],
    ["en", "(Still to come: there is no text yet. Does not count as evidence yet.)"],
  ] as const) {
    it(`tells the coach it is still to come (${locale})`, () => {
      const message = buildCoachMessage(withPending(), LU, locale);
      expect(message).toContain("# Video van de les");
      expect(message).toContain(label);
      expect(buildCoachMessage(sampleDossier(), LU, locale)).not.toContain(label);
    });
  }

  it("is no source for a drafted paragraph", () => {
    // No outline: the criterion is the section.
    expect(buildSectionDraftMessage(withPending(), LU, C1, "", "nl")).toBeNull();
    expect(buildSectionDraftMessage(sampleDossier(), LU, C1, "", "nl")).not.toBeNull();
  });

  it("is named as still to come in the rehearsal", () => {
    const { values } = buildRehearsalContext(withPending(), { length: "short", locale: "nl" });
    expect(values.evidenceTitles).toContain("Video van de les (volgt nog;");
  });
});
