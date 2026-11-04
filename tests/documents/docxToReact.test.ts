// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sanitizeDocxHtml, docxToSafeNodes, safeNodesText } from "~/lib/documents/docxHtml";
import { SafeNodes } from "~/components/documents/SafeNodes";

/**
 * The Word view (24.0c): mammoth's HTML never reaches `dangerouslySetInnerHTML`.
 * It is parsed into a small allow-listed tree, then rendered as React elements.
 */
const render = (html: string) =>
  renderToStaticMarkup(
    createElement(SafeNodes, { nodes: sanitizeDocxHtml(html), imageAlt: "Afbeelding" }),
  );

describe("sanitizeDocxHtml", () => {
  it("keeps headings, paragraphs, lists, tables and emphasis", () => {
    const html =
      "<h1>Titel</h1><p>Een <strong>vet</strong> en <em>schuin</em> woord.<br/>Regel twee</p>" +
      "<ul><li>een</li></ul><ol><li>twee</li></ol>" +
      "<table><thead><tr><th>Kop</th></tr></thead><tbody><tr><td>Cel</td></tr></tbody></table>";
    const out = render(html);
    for (const tag of [
      "<h1",
      "<p",
      "<strong",
      "<em",
      "<br",
      "<ul",
      "<ol",
      "<li",
      "<table",
      "<thead",
      "<tbody",
      "<tr",
      "<th",
      "<td",
    ]) {
      expect(out, tag).toContain(tag);
    }
    expect(out).toContain("Titel");
    expect(out).toContain("Cel");
  });

  it("drops scripts, styles and embedded frames together with their content", () => {
    const out = render(
      '<p>ok</p><script>alert(1)</script><style>p{}</style><iframe title="x"></iframe><object>o</object>',
    );
    expect(out).toContain("ok");
    expect(out).not.toMatch(/script|alert|style|iframe|object/);
  });

  it("strips event handlers, styles and every other attribute", () => {
    const out = render('<p onclick="steal()" style="color:red" class="x" id="y">tekst</p>');
    expect(out).not.toMatch(/onclick|steal|style=|class="x"|id=/);
    expect(out).toContain("tekst");
  });

  it("keeps only http(s) links, opened safely", () => {
    const out = render(
      '<p><a href="https://example.org/a">goed</a> <a href="javascript:alert(1)">fout</a> <a href="data:text/html,x">ook fout</a></p>',
    );
    expect(out).toContain('href="https://example.org/a"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("data:text/html");
    // The text of a refused link survives as plain text.
    expect(out).toContain("fout");
  });

  it("keeps embedded data: images but drops external and svg sources", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    const out = render(
      `<p><img src="${png}" alt="Grafiek omzet"/><img src="https://tracker.example/p.gif"/><img src="data:image/svg+xml;base64,PHN2Zz4="/></p>`,
    );
    expect(out).toContain(`src="${png}"`);
    expect(out).toContain('alt="Grafiek omzet"');
    expect(out).not.toContain("tracker.example");
    expect(out).not.toContain("svg+xml");
  });

  it("gives an image without a description a fallback alt text", () => {
    const out = render('<p><img src="data:image/jpeg;base64,/9j/4AAQ"/></p>');
    expect(out).toContain('alt="Afbeelding"');
  });

  it("unwraps unknown tags but keeps their text", () => {
    const out = render("<p><span>binnen</span> <sup>1</sup> <u>onder</u></p>");
    expect(out).toContain("binnen");
    expect(out).toContain("1");
    expect(out).not.toMatch(/<span|<sup|<u>/);
  });
});

describe("docxToSafeNodes", () => {
  it("renders the real DOCX fixture with its text", async () => {
    const bytes = new Uint8Array(readFileSync(resolve(__dirname, "../fixtures/sample.docx")));
    const nodes = await docxToSafeNodes(bytes);
    const text = safeNodesText(nodes);
    expect(text).toContain("STAGEFIXTUREDOCX");
    expect(text).toContain("Tweede alinea");
  });
});
