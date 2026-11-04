import { describe, expect, it } from "vitest";
import { countFilledDetails } from "~/lib/context/details";
import type { ContextProfile } from "~/lib/context/types";

const open: ContextProfile = {
  id: "p",
  name: "Alleen open velden",
  sector: "hbo",
  track: "bachelor",
  nationalLevel: "6",
  programme: "HBO-ICT",
  courseName: "Backend",
  studyYear: 3,
};

describe("countFilledDetails", () => {
  it("counts 0 for a profile with only the open fields (the level does not count)", () => {
    expect(countFilledDetails(open)).toBe(0);
  });

  it("counts a domain", () => {
    expect(countFilledDetails({ ...open, domain: "ICT" })).toBe(1);
  });

  it("counts each filled free field and ignores blank ones", () => {
    expect(
      countFilledDetails({
        ...open,
        professionalContext: "Softwarebedrijven",
        tools: "Java",
        pedagogy: "Probleemgestuurd",
        learnerNounOverride: "deelnemers",
      }),
    ).toBe(4);
    expect(countFilledDetails({ ...open, professionalContext: "  ", tools: "" })).toBe(0);
  });

  it("counts each filled framework field, not empty selections", () => {
    expect(
      countFilledDetails({
        ...open,
        packValues: { lagen: ["Software", "Infra"], niveau: 2, leeg: [], tekst: " " },
      }),
    ).toBe(2);
  });

  it("counts each custom field with a label or a value", () => {
    expect(
      countFilledDetails({
        ...open,
        customFields: [
          { label: "Specialisatie", value: "Security" },
          { label: "", value: "" },
        ],
      }),
    ).toBe(1);
  });

  it("adds everything up", () => {
    expect(
      countFilledDetails({
        ...open,
        domain: "ICT",
        pedagogy: "PGO",
        packValues: { lagen: ["Software"], niveau: 2 },
        customFields: [{ label: "A", value: "B" }],
      }),
    ).toBe(5);
  });
});
