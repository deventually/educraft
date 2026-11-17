import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { type AuditException, auditVerdict } from "../../scripts/audit";

const root = resolve(__dirname, "../..");

// The shape `npm audit --json` prints: an advisory sits on the package it was found in; packages
// that only depend on it name it as a string in `via`.
function report(advisories: { name: string; ghsa: string; severity: string }[]) {
  const vulnerabilities: Record<string, unknown> = {};
  for (const a of advisories) {
    vulnerabilities[a.name] = {
      name: a.name,
      severity: a.severity,
      via: [
        {
          source: 1,
          name: a.name,
          title: "something",
          url: `https://github.com/advisories/${a.ghsa}`,
          severity: a.severity,
        },
      ],
    };
  }
  vulnerabilities.vite = { name: "vite", severity: "high", via: advisories.map((a) => a.name) };
  return { vulnerabilities };
}

const picomatch = { name: "picomatch", ghsa: "GHSA-fc5q-39xc-vjpf", severity: "high" };
const exception: AuditException = {
  id: "GHSA-fc5q-39xc-vjpf",
  package: "picomatch",
  reason: "dev tools only",
  added: "2026-11-17",
  until: "2026-12-31",
};

describe("auditVerdict (the whole tree, from high)", () => {
  it("passes a clean tree", () => {
    expect(auditVerdict({ vulnerabilities: {} }, [], "2026-11-17").blocking).toEqual([]);
  });

  it("blocks a high advisory that has no exception", () => {
    const v = auditVerdict(report([picomatch]), [], "2026-11-17");
    expect(v.blocking).toEqual(["GHSA-fc5q-39xc-vjpf (picomatch, high)"]);
  });

  it("blocks a critical advisory too, but not a moderate or low one", () => {
    const v = auditVerdict(
      report([
        { name: "a", ghsa: "GHSA-aaaa-aaaa-aaaa", severity: "critical" },
        { name: "b", ghsa: "GHSA-bbbb-bbbb-bbbb", severity: "moderate" },
        { name: "c", ghsa: "GHSA-cccc-cccc-cccc", severity: "low" },
      ]),
      [],
      "2026-11-17",
    );
    expect(v.blocking).toEqual(["GHSA-aaaa-aaaa-aaaa (a, critical)"]);
  });

  it("lets an advisory with a current exception through, and names it", () => {
    const v = auditVerdict(report([picomatch]), [exception], "2026-12-31");
    expect(v.blocking).toEqual([]);
    expect(v.excepted).toEqual(["GHSA-fc5q-39xc-vjpf (picomatch, high)"]);
  });

  it("blocks again once the exception has expired", () => {
    const v = auditVerdict(report([picomatch]), [exception], "2027-01-01");
    expect(v.blocking).toEqual([
      "GHSA-fc5q-39xc-vjpf (picomatch, high): exception expired 2026-12-31",
    ]);
  });

  it("an exception covers only its own advisory in its own package", () => {
    const other = { name: "picomatch", ghsa: "GHSA-zzzz-zzzz-zzzz", severity: "high" };
    const elsewhere = { name: "minimatch", ghsa: "GHSA-fc5q-39xc-vjpf", severity: "high" };
    const v = auditVerdict(report([other, elsewhere]), [exception], "2026-11-17");
    expect(v.blocking).toEqual([
      "GHSA-zzzz-zzzz-zzzz (picomatch, high)",
      "GHSA-fc5q-39xc-vjpf (minimatch, high)",
    ]);
  });

  it("names an exception that is no longer needed, so it gets removed", () => {
    const v = auditVerdict({ vulnerabilities: {} }, [exception], "2026-11-17");
    expect(v.blocking).toEqual([]);
    expect(v.unused).toEqual(["GHSA-fc5q-39xc-vjpf (picomatch)"]);
  });

  it("fails closed on output it cannot read", () => {
    expect(() => auditVerdict({ error: "network" }, [], "2026-11-17")).toThrow();
  });
});

describe("config/audit-exceptions.json", () => {
  const exceptions = JSON.parse(
    readFileSync(resolve(root, "config/audit-exceptions.json"), "utf8"),
  ) as AuditException[];

  it("every exception says why, names its package and runs at most three months", () => {
    for (const e of exceptions) {
      expect(e.id).toMatch(/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/);
      expect(e.package).toBeTruthy();
      expect(e.reason.length).toBeGreaterThan(40);
      const days = (Date.parse(e.until) - Date.parse(e.added)) / 86_400_000;
      expect(days).toBeGreaterThan(0);
      expect(days).toBeLessThanOrEqual(92);
    }
  });
});
