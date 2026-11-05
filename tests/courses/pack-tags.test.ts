// P21.6: pack tags on a learning outcome. The fields and options come from the pack of the
// course's context profile (data, `DOMAIN_PACKS`); no pack → no tags. Old data stays valid.
import { describe, expect, it } from "vitest";
import { buildReviewMessage } from "~/lib/agents/input";
import { getDomainPack } from "~/lib/context/packs";
import { applyImport } from "~/lib/courses/import";
import { applyCourseIntent } from "~/lib/courses/intents";
import { parsePackTags } from "~/lib/courses/packTags";
import { CourseDataSchema } from "~/lib/courses/schema";
import { alignedCourse, LO1 } from "./fixtures";

const ICT = getDomainPack("ICT")!;

function form(entries: [string, string][]): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

describe("pack tags", () => {
  it("are optional in the course schema and bounded in shape", () => {
    const old = alignedCourse();
    expect(CourseDataSchema.safeParse(old).success).toBe(true);
    const tagged = alignedCourse();
    tagged.outcomes[0].packTags = { beheersingsniveau: 3, activiteiten: ["Ontwerpen"] };
    expect(CourseDataSchema.safeParse(tagged).success).toBe(true);
    const bad = alignedCourse();
    (bad.outcomes[0] as { packTags?: unknown }).packTags = { beheersingsniveau: { x: 1 } };
    expect(CourseDataSchema.safeParse(bad).success).toBe(false);
  });

  it("parse from the form against the pack", () => {
    const fd = form([
      ["tag:beheersingsniveau", "2"],
      ["tag:activiteiten", "Ontwerpen"],
      ["tag:activiteiten", "Realiseren"],
      ["tag:architectuurlagen", ""],
    ]);
    expect(parsePackTags(fd, ICT)).toEqual({
      ok: true,
      tags: { beheersingsniveau: 2, activiteiten: ["Ontwerpen", "Realiseren"] },
    });
    expect(parsePackTags(form([]), ICT)).toEqual({ ok: true, tags: undefined });
  });

  it("refuse an unknown key, an unknown option and a level out of range", () => {
    expect(parsePackTags(form([["tag:verzonnen", "x"]]), ICT).ok).toBe(false);
    expect(parsePackTags(form([["tag:activiteiten", "Dansen"]]), ICT).ok).toBe(false);
    expect(parsePackTags(form([["tag:beheersingsniveau", "4"]]), ICT).ok).toBe(false);
  });

  it("are saved by the outcome intents only when the course has a pack", () => {
    const fd = form([
      ["intent", "update-outcome"],
      ["id", LO1],
      ["text", "Je ontwerpt een datamodel."],
      ["bloom", "create"],
      ["tag:beheersingsniveau", "3"],
    ]);
    const withPack = applyCourseIntent(alignedCourse(), fd, { pack: ICT });
    expect(withPack.ok && withPack.data.outcomes[0].packTags).toEqual({ beheersingsniveau: 3 });

    // Without a pack the tag fields are ignored and existing tags are kept.
    const tagged = alignedCourse();
    tagged.outcomes[0].packTags = { beheersingsniveau: 1 };
    const noPack = applyCourseIntent(tagged, fd);
    expect(noPack.ok && noPack.data.outcomes[0].packTags).toEqual({ beheersingsniveau: 1 });

    const add = applyCourseIntent(
      alignedCourse(),
      form([
        ["intent", "add-outcome"],
        ["text", "Je adviseert."],
        ["tag:activiteiten", "Adviseren"],
      ]),
      { pack: ICT },
    );
    expect(add.ok && add.data.outcomes.at(-1)?.packTags).toEqual({ activiteiten: ["Adviseren"] });

    const refused = applyCourseIntent(
      alignedCourse(),
      form([
        ["intent", "add-outcome"],
        ["text", "Je danst."],
        ["tag:activiteiten", "Dansen"],
      ]),
      { pack: ICT },
    );
    expect(refused).toEqual({ ok: false, error: "invalid" });
  });

  it("clearing every tag removes them", () => {
    const tagged = alignedCourse();
    tagged.outcomes[0].packTags = { beheersingsniveau: 1 };
    const r = applyCourseIntent(
      tagged,
      form([
        ["intent", "update-outcome"],
        ["id", LO1],
        ["text", "Je ontwerpt een datamodel."],
        ["tag:beheersingsniveau", ""],
      ]),
      { pack: ICT },
    );
    expect(r.ok && "packTags" in r.data.outcomes[0]).toBe(false);
  });

  it("go into the hat's input, next to Bloom", () => {
    const c = alignedCourse();
    c.outcomes[0].packTags = { beheersingsniveau: 3, activiteiten: ["Ontwerpen", "Realiseren"] };
    const msg = buildReviewMessage({ course: c, alignment: [], rejected: [] }, "nl");
    expect(msg).toContain(
      "L1 (bloom: create, beheersingsniveau: 3, activiteiten: Ontwerpen + Realiseren): Je ontwerpt een datamodel.",
    );
  });

  it("an import leaves new outcomes untagged and keeps the tags of existing ones", () => {
    const c = alignedCourse();
    c.outcomes[0].packTags = { beheersingsniveau: 3 };
    const r = applyImport(c, {
      outcomes: [
        { key: "o1", pick: true, text: c.outcomes[0].text, bloom: "apply" },
        { key: "o2", pick: true, text: "Je schrijft SQL-queries." },
      ],
      assessments: [],
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.data.outcomes[0].packTags).toEqual({ beheersingsniveau: 3 });
    expect(r.data.outcomes.at(-1)?.packTags).toBeUndefined();
  });
});
