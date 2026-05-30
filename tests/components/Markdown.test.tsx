import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Markdown } from "~/components/Markdown";

describe("Markdown", () => {
  it("syntax-highlights a fenced code block with a language hint", async () => {
    const { container } = render(<Markdown>{"```js\nconst greeting = 'hi';\n```"}</Markdown>);
    // rehype-highlight wraps recognised code in `hljs` and emits token spans.
    const code = container.querySelector("pre code.hljs");
    expect(code).toBeTruthy();
    expect(container.querySelector(".hljs-keyword, .hljs-string, .hljs-title")).toBeTruthy();
  });

  it("still renders a fenced block without a language as a code block", () => {
    const { container } = render(<Markdown>{"```\nplain fenced text\n```"}</Markdown>);
    const pre = container.querySelector("pre code");
    expect(pre).toBeTruthy();
    expect(pre?.textContent).toContain("plain fenced text");
  });

  it("renders inline code without turning it into a block", () => {
    const { container } = render(<Markdown>{"Use the `npm test` command."}</Markdown>);
    expect(container.querySelector("pre")).toBeNull();
    expect(container.querySelector("code")?.textContent).toBe("npm test");
  });

  it("has no a11y violations", async () => {
    const { container } = render(<Markdown>{"# Title\n\n```ts\ntype X = number;\n```"}</Markdown>);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
