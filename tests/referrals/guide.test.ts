import { describe, expect, it } from "vitest";
import { parseReferralGuide, REFERRAL_KINDS, referralGuideFromForm } from "~/lib/referrals/guide";

/** P39.4: the referral guide is admin data, validated with Zod at the boundary. */
describe("referral guide (P39.4), parse and form seam", () => {
  it("knows the five kinds of question from the brief, in NL and EN", () => {
    expect(REFERRAL_KINDS.map((k) => k.id)).toEqual([
      "study-delay",
      "mental-health",
      "disability",
      "unwanted-behaviour",
      "money",
    ]);
    for (const k of REFERRAL_KINDS) {
      expect(k.label.nl).toBeTruthy();
      expect(k.label.en).toBeTruthy();
    }
  });

  it("reads a form: a kind without a counter is left out, the rest keeps the kind order", () => {
    const fd = new FormData();
    fd.set("counter-money", "Studentendecaan");
    fd.set("link-money", "https://school.nl/geld");
    fd.set("counter-study-delay", "  Studieadviseur  ");
    fd.set("description-study-delay", "Bij vertraging en vragen over regels.");
    const r = referralGuideFromForm(fd);
    expect(r).toEqual({
      ok: true,
      guide: [
        {
          kind: "study-delay",
          counter: "Studieadviseur",
          description: "Bij vertraging en vragen over regels.",
          link: "",
        },
        {
          kind: "money",
          counter: "Studentendecaan",
          description: "",
          link: "https://school.nl/geld",
        },
      ],
    });
  });

  it("an empty form is an empty guide", () => {
    expect(referralGuideFromForm(new FormData())).toEqual({ ok: true, guide: [] });
  });

  it("refuses a link that is not https or mailto", () => {
    for (const link of [
      "javascript:alert(1)",
      "http://school.nl",
      "data:text/html,x",
      "school.nl",
    ]) {
      const fd = new FormData();
      fd.set("counter-money", "Decaan");
      fd.set("link-money", link);
      expect(referralGuideFromForm(fd), link).toEqual({ ok: false, kind: "money" });
    }
    const fd = new FormData();
    fd.set("counter-money", "Decaan");
    fd.set("link-money", "mailto:decaan@school.nl");
    expect(referralGuideFromForm(fd).ok).toBe(true);
  });

  it("refuses text over the caps, and a description or link without a counter", () => {
    const long = new FormData();
    long.set("counter-disability", "x".repeat(121));
    expect(referralGuideFromForm(long)).toEqual({ ok: false, kind: "disability" });
    const desc = new FormData();
    desc.set("counter-disability", "Decaan");
    desc.set("description-disability", "x".repeat(401));
    expect(referralGuideFromForm(desc)).toEqual({ ok: false, kind: "disability" });
    const orphan = new FormData();
    orphan.set("link-disability", "https://school.nl");
    expect(referralGuideFromForm(orphan)).toEqual({ ok: false, kind: "disability" });
  });

  it("parsing stored JSON drops what is not valid, never throws", () => {
    expect(parseReferralGuide("nonsense")).toEqual([]);
    expect(parseReferralGuide(null)).toEqual([]);
    expect(
      parseReferralGuide([
        { kind: "money", counter: "Decaan", description: "", link: "javascript:x" },
        { kind: "nope", counter: "X", description: "", link: "" },
        { kind: "disability", counter: "Decaan", description: "", link: "" },
        { kind: "disability", counter: "Dubbel", description: "", link: "" },
      ]),
    ).toEqual([{ kind: "disability", counter: "Decaan", description: "", link: "" }]);
  });
});
