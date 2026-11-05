import { describe, expect, it } from "vitest";
import { decide, type InstanceStand, type Choice } from "~/lib/features/rule";
import { FEATURES, validateFeatures } from "~/lib/features";

/** One team's choice, by name; absent = no choice. */
const team = (id: string, choice?: Choice) => ({ id, name: `Team ${id}`, choice });

describe("the on/off rule (P28.3)", () => {
  it("instance Off wins over everything", () => {
    expect(decide("off", [team("a", "on")], "on")).toEqual({ on: false, source: "instance" });
  });

  it("a teacher's exception wins over teams and the default", () => {
    expect(decide("on", [team("a", "on")], "off")).toEqual({ on: false, source: "exception" });
    expect(decide("request", [team("a", "off")], "on")).toEqual({
      on: true,
      source: "exception",
    });
  });

  it("one team saying on is enough, also when another says off", () => {
    expect(decide("request", [team("a", "off"), team("b", "on")])).toEqual({
      on: true,
      source: "team",
      team: "Team b",
    });
  });

  it("a team saying off turns a default-on part off", () => {
    expect(decide("on", [team("a"), team("b", "off")])).toEqual({
      on: false,
      source: "team",
      team: "Team b",
    });
  });

  it("without any choice the instance default applies", () => {
    const cases: [InstanceStand, boolean][] = [
      ["on", true],
      ["request", false],
    ];
    for (const [stand, on] of cases) {
      expect(decide(stand, [])).toEqual({ on, source: "default" });
      expect(decide(stand, [team("a")])).toEqual({ on, source: "default" });
    }
  });

  it("covers every combination consistently", () => {
    const stands: InstanceStand[] = ["off", "on", "request"];
    const choices: (Choice | undefined)[] = [undefined, "on", "off"];
    for (const stand of stands)
      for (const exception of choices)
        for (const a of choices)
          for (const b of choices) {
            const r = decide(stand, [team("a", a), team("b", b)], exception);
            if (stand === "off") expect(r.on).toBe(false);
            else if (exception) expect(r.on).toBe(exception === "on");
            else if (a === "on" || b === "on") expect(r.on).toBe(true);
            else if (a === "off" || b === "off") expect(r.on).toBe(false);
            else expect(r.on).toBe(stand === "on");
          }
  });
});

describe("the feature register (P28.3)", () => {
  it("holds the four parts with their default stands", () => {
    expect(FEATURES.map((f) => [f.id, f.defaultStand])).toEqual([
      ["portfolio", "request"],
      ["courses", "on"],
      ["roleAgents", "on"],
      ["utilities", "on"],
    ]);
    for (const f of FEATURES) {
      expect(f.name.nl.length).toBeGreaterThan(0);
      expect(f.name.en.length).toBeGreaterThan(0);
    }
  });

  it("is valid, and validation catches a bad entry", () => {
    expect(validateFeatures(FEATURES)).toEqual([]);
    const bad = [
      ...FEATURES,
      { id: "courses", name: { nl: "", en: "x" }, defaultStand: "maybe" },
    ] as unknown as typeof FEATURES;
    expect(validateFeatures(bad).length).toBeGreaterThanOrEqual(2);
  });
});
