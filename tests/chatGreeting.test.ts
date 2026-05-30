import { describe, it, expect } from "vitest";
import { ALL_TOOLS } from "~/lib/registry";
import { interpolateGreeting } from "~/lib/chat/greeting";
import { loc } from "~/lib/i18n/localized";

/**
 * Chat greetings are LocalizedText shown verbatim by ChatView. At least one tool
 * (scaffolding-feedback) personalises its greeting with a {{subject}} placeholder
 * sourced from the sandbox inputs. The greeting must be interpolated before
 * display so users never see a literal "{{subject}}".
 */
describe("chat greeting interpolation", () => {
  const chatTools = ALL_TOOLS.filter((t) => t.mode === "chat" && t.chat?.greeting);

  it("substitutes sandbox values into greeting placeholders ({{subject}})", () => {
    const scaffolding = ALL_TOOLS.find((t) => t.slug === "scaffolding-feedback");
    const raw = loc(scaffolding!.chat!.greeting!, "nl");
    expect(raw).toContain("{{subject}}"); // the template itself has the placeholder
    const prepared = interpolateGreeting(raw, { subject: "wiskunde" });
    expect(prepared).toContain("wiskunde");
    expect(prepared).not.toMatch(/\{\{.*?\}\}/);
  });

  it("leaves no unresolved placeholder in any chat greeting (nl + en), even with empty values", () => {
    for (const tool of chatTools) {
      for (const locale of ["nl", "en"] as const) {
        const prepared = interpolateGreeting(loc(tool.chat!.greeting!, locale), {});
        expect(prepared, `${tool.slug} (${locale})`).not.toMatch(/\{\{.*?\}\}/);
      }
    }
  });

  it("leaves a placeholder-free greeting untouched", () => {
    expect(interpolateGreeting("Hallo! Waar begin je?", { subject: "x" })).toBe(
      "Hallo! Waar begin je?",
    );
  });
});
