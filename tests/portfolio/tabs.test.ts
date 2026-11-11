import { describe, expect, it } from "vitest";
import {
  DOSSIER_TABS,
  OUTCOME_TABS,
  dossierHref,
  dossierTab,
  outcomeHref,
  outcomeTab,
} from "~/lib/portfolio/tabs";

describe("dossier and outcome tabs", () => {
  it("names the tabs in order", () => {
    expect(DOSSIER_TABS).toEqual(["overview", "finish"]);
    expect(OUTCOME_TABS).toEqual(["overview", "evidence", "chapter", "review"]);
  });

  it("reads a tab from ?tab=, anything else is the overview", () => {
    expect(dossierTab("finish")).toBe("finish");
    expect(dossierTab("nope")).toBe("overview");
    expect(dossierTab(null)).toBe("overview");
    expect(outcomeTab("review")).toBe("review");
    expect(outcomeTab("finish")).toBe("overview");
  });

  it("links to a tab, without a query for the overview, optionally to an anchor", () => {
    expect(dossierHref("d1", "overview")).toBe("/portfolio/d1");
    expect(dossierHref("d1", "finish", "readiness")).toBe("/portfolio/d1?tab=finish#readiness");
    expect(outcomeHref("d1", "o1", "overview")).toBe("/portfolio/d1/outcome/o1");
    expect(outcomeHref("d1", "o1", "evidence", "evidence-title")).toBe(
      "/portfolio/d1/outcome/o1?tab=evidence#evidence-title",
    );
  });
});
