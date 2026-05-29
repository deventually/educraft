import { describe, it, expect } from "vitest";
import { messages, LOCALES, DEFAULT_LOCALE, isLocale, getMessages } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";

/** Recursively collect every dotted leaf key path of an object. */
function leafKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

/** Collect every leaf string value of an object. */
function leafValues(obj: unknown): string[] {
  if (typeof obj === "string") return [obj];
  if (obj === null || typeof obj !== "object") return [];
  return Object.values(obj as Record<string, unknown>).flatMap(leafValues);
}

describe("i18n", () => {
  it("defaults to Dutch", () => {
    expect(DEFAULT_LOCALE).toBe("nl");
  });

  it("supports exactly nl and en", () => {
    expect([...LOCALES].sort()).toEqual(["en", "nl"]);
  });

  it("every locale has an identical set of message keys", () => {
    const nlKeys = leafKeys(messages.nl).sort();
    for (const locale of LOCALES) {
      const localeKeys = leafKeys(messages[locale]).sort();
      expect(localeKeys, `locale "${locale}" key mismatch`).toEqual(nlKeys);
    }
  });

  it("has no empty message strings in any locale", () => {
    for (const locale of LOCALES) {
      for (const value of leafValues(messages[locale])) {
        expect(value.trim().length, `empty string in "${locale}"`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps interpolation placeholders consistent across locales", () => {
    const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    const nlEntries = Object.fromEntries(
      leafKeys(messages.nl).map((k, i) => [k, leafValues(messages.nl)[i]]),
    );
    // Compare placeholder sets per key between nl and en.
    const nlFlat = flatten(messages.nl);
    const enFlat = flatten(messages.en);
    for (const key of Object.keys(nlFlat)) {
      expect(placeholders(enFlat[key]), `placeholders differ for "${key}"`).toEqual(
        placeholders(nlFlat[key]),
      );
    }
    void nlEntries;
  });

  it("validates locale codes", () => {
    expect(isLocale("nl")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });

  it("getMessages falls back to the default for unknown locales", () => {
    expect(getMessages("nl")).toBe(messages.nl);
    expect(getMessages("en")).toBe(messages.en);
    expect(getMessages("xx")).toBe(messages.nl);
    expect(getMessages(null)).toBe(messages.nl);
  });
});

describe("fmt", () => {
  it("interpolates single-brace variables", () => {
    expect(fmt("Hallo {name}!", { name: "Bas" })).toBe("Hallo Bas!");
  });

  it("interpolates numbers and repeated keys", () => {
    expect(fmt("Niveau {n} (niveau {n})", { n: 2 })).toBe("Niveau 2 (niveau 2)");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(fmt("Hi {missing}", { name: "x" })).toBe("Hi {missing}");
  });
});

/** Flatten to dotted-key → string map (strings only). */
function flatten(obj: unknown, prefix = ""): Record<string, string> {
  if (typeof obj === "string") return { [prefix]: obj };
  if (obj === null || typeof obj !== "object") return {};
  return Object.entries(obj as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [k, v]) => Object.assign(acc, flatten(v, prefix ? `${prefix}.${k}` : k)),
    {},
  );
}
