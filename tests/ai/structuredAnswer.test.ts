import { describe, expect, it } from "vitest";
import {
  STRUCTURED_INPUT_LIMIT,
  extractJson,
  verbatimIn,
  wrapAsData,
} from "~/lib/ai/structuredAnswer";
import { normalizeForMatch } from "~/lib/documents/locate";

describe("extractJson", () => {
  it("finds the first JSON object, fenced or bare", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('Hier:\n```json\n{"a":2}\n```\nKlaar.')).toEqual({ a: 2 });
    expect(extractJson('tekst ervoor {"a":3} tekst erna')).toEqual({ a: 3 });
  });

  it("is undefined for no object or broken JSON", () => {
    expect(extractJson("geen json")).toBeUndefined();
    expect(extractJson('{"a": ')).toBeUndefined();
  });
});

describe("wrapAsData", () => {
  it("wraps text in a tag and clips it at the input limit", () => {
    expect(wrapAsData("form", "abc")).toBe("<form>\nabc\n</form>");
    const long = wrapAsData("document", "x".repeat(STRUCTURED_INPUT_LIMIT + 10));
    expect(long.length).toBeLessThan(STRUCTURED_INPUT_LIMIT + 50);
    expect(long).toContain("[…]");
  });
});

describe("verbatimIn", () => {
  const source = normalizeForMatch("De student ont-\nwerpt een datamodel.\n2. Hij test het.");
  it("matches modulo layout, case and a closing full stop", () => {
    expect(verbatimIn("De student ontwerpt een datamodel.", source)).toBe(true);
    expect(verbatimIn("hij test het;", source)).toBe(true);
  });
  it("does not match a paraphrase or an empty string", () => {
    expect(verbatimIn("De student maakt een datamodel.", source)).toBe(false);
    expect(verbatimIn("  ", source)).toBe(false);
  });
});
