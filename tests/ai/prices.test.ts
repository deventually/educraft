import { describe, expect, it } from "vitest";
import {
  callCost,
  formatEuro,
  listPriceInEuro,
  parseModelPrices,
  parsePriceForm,
} from "~/lib/ai/prices";

const usage = {
  input: 1_000_000,
  cacheRead: 2_000_000,
  cacheWrite: 500_000,
  output: 100_000,
  reasoning: 0,
};

// Seam: what one call cost, in millionths of a euro, from the model's price per million tokens.
describe("callCost", () => {
  it("prices every kind of token at its own rate", () => {
    const price = { input: 3, cacheRead: 0.3, cacheWrite: 3.75, output: 15 };
    // 3 + 0.6 + 1.875 + 1.5 = 6.975 euro
    expect(callCost(usage, price)).toBe(6_975_000);
  });

  it("prices cache tokens like input when the cache rates are left empty", () => {
    expect(callCost(usage, { input: 1, output: 2 })).toBe(3_700_000);
  });

  it("is unknown without a price, so the dashboard never shows a too-low total", () => {
    expect(callCost(usage, undefined)).toBeUndefined();
  });
});

describe("parseModelPrices", () => {
  it("keeps valid prices and drops a negative or non-numeric one", () => {
    expect(
      parseModelPrices({
        good: { input: 0.25, output: 1.25 },
        negative: { input: -1, output: 1 },
        text: { input: "a", output: 1 },
      }),
    ).toEqual({ good: { input: 0.25, output: 1.25 } });
  });

  it("is empty for anything that is not a price map", () => {
    expect(parseModelPrices(null)).toEqual({});
    expect(parseModelPrices("x")).toEqual({});
  });
});

describe("parsePriceForm", () => {
  const form = (input: string, cacheRead: string, cacheWrite: string, output: string) => ({
    input,
    cacheRead,
    cacheWrite,
    output,
  });

  it("reads a comma as decimal sign and leaves empty cache rates out", () => {
    expect(parsePriceForm(form("0,8", "0,08", "", "4"))).toEqual({
      input: 0.8,
      cacheRead: 0.08,
      output: 4,
    });
  });

  it("means 'remove the price' when every field is empty", () => {
    expect(parsePriceForm(form("", " ", "", ""))).toBeNull();
  });

  it("refuses a missing output rate, a negative rate or text", () => {
    expect(parsePriceForm(form("1", "", "", ""))).toBe("invalid");
    expect(parsePriceForm(form("-1", "", "", "2"))).toBe("invalid");
    expect(parsePriceForm(form("een", "", "", "2"))).toBe("invalid");
  });
});

describe("listPriceInEuro", () => {
  it("converts a dollar list price with the exchange rate, rounded to a ten-thousandth", () => {
    expect(
      listPriceInEuro({ currency: "USD", input: 3, output: 15, cacheRead: 0.3 }, 0.8612),
    ).toEqual({ input: 2.5836, output: 12.918, cacheRead: 0.2584 });
  });

  it("keeps a euro list price as it is", () => {
    expect(listPriceInEuro({ currency: "EUR", input: 1, output: 2 }, undefined)).toEqual({
      input: 1,
      output: 2,
    });
  });
});

describe("formatEuro", () => {
  it("shows cents from one euro up, and up to four decimals below", () => {
    expect(formatEuro(8.917, "nl")).toMatch(/^€\s8,92$/);
    expect(formatEuro(0.0892, "nl")).toMatch(/^€\s0,0892$/);
    expect(formatEuro(3, "en")).toBe("€3.00");
  });
});
