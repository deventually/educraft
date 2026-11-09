import type { Hit } from "~/lib/documents/locate";

/** The name of the CSS Custom Highlight that marks a hit's words in a Word view (app.css). */
const HIT_HIGHLIGHT = "document-hit";

/**
 * Marks the hit's words inside a Word paragraph without touching React's DOM,
 * through the CSS Custom Highlight API. Where a browser lacks it, the paragraph
 * mark alone shows the place.
 */
export function highlightWords(block: HTMLElement | undefined, hit: Hit | null) {
  const registry = typeof CSS === "undefined" ? undefined : CSS.highlights;
  if (!registry || typeof Highlight === "undefined") return;
  registry.delete(HIT_HIGHLIGHT);
  if (!block || !hit) return;
  const range = document.createRange();
  let offset = 0;
  let started = false;
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0;
    if (!started && hit.start <= offset + length) {
      range.setStart(node, hit.start - offset);
      started = true;
    }
    if (started && hit.end <= offset + length) {
      range.setEnd(node, hit.end - offset);
      registry.set(HIT_HIGHLIGHT, new Highlight(range));
      return;
    }
    offset += length;
  }
}
