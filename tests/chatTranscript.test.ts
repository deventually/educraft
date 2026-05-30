import { describe, it, expect } from "vitest";
import { buildChatTranscript } from "~/lib/chat/transcript";
import type { ChatMessage } from "~/lib/registry/types";

const convo: ChatMessage[] = [
  { role: "user", content: "What is OOP?" },
  { role: "assistant", content: "Object-oriented programming organises code around objects." },
  { role: "user", content: "Show me an example" },
  { role: "assistant", content: "```js\nclass Dog {}\n```" },
];

describe("buildChatTranscript", () => {
  it("renders the whole conversation as one markdown document", () => {
    const md = buildChatTranscript(convo, "en");
    // Every turn appears, in order, under a labelled heading.
    expect(md).toContain("**You:**");
    expect(md).toContain("**Assistant:**");
    expect(md).toContain("What is OOP?");
    expect(md).toContain("Object-oriented programming organises code around objects.");
    expect(md.indexOf("What is OOP?")).toBeLessThan(md.indexOf("Show me an example"));
  });

  it("preserves fenced code blocks verbatim so they can be highlighted", () => {
    const md = buildChatTranscript(convo, "en");
    expect(md).toContain("```js\nclass Dog {}\n```");
  });

  it("uses Dutch labels for nl output", () => {
    const md = buildChatTranscript(convo, "nl");
    expect(md).toContain("**Jij:**");
    expect(md).toContain("**Assistent:**");
    expect(md).not.toContain("**You:**");
  });

  it("skips empty/whitespace-only turns", () => {
    const md = buildChatTranscript(
      [
        { role: "user", content: "  " },
        { role: "assistant", content: "Hi there" },
      ],
      "en",
    );
    expect(md).toBe("**Assistant:**\n\nHi there");
  });
});
