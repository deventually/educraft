/**
 * A wide child (a Word table, a long link) must never stretch the page. In CSS grid
 * an item's minimum width is its content's width unless the track is declared
 * `minmax(0, …)` (Tailwind `grid-cols-N`) and the item says `min-w-0`. happy-dom has
 * no layout, so this checks that contract on the classes from `el` up to `stop`.
 */
export function gridBlowoutRisks(el: Element, stop: Element): string[] {
  const risks: string[] = [];
  for (let node = el.parentElement; node && node !== stop; node = node.parentElement) {
    const classes = node.className.toString().split(/\s+/);
    if (!classes.includes("grid")) continue;
    if (!classes.some((c) => /^grid-cols-/.test(c))) {
      risks.push(`grid without zero-minimum columns: "${node.className}"`);
    }
    const item = Array.from(node.children).find((c) => c.contains(el));
    if (item && !item.className.toString().split(/\s+/).includes("min-w-0")) {
      risks.push(`grid item without min-w-0: "${item.className}"`);
    }
  }
  return risks;
}

/**
 * Hidden screen-reader text (`sr-only`) is absolutely positioned. Without a positioned
 * ancestor inside `root` it is placed against the page and stretches it (the page then
 * scrolls far past the footer). Returns the ones that escape.
 */
export function escapingSrOnly(root: Element): Element[] {
  const isPositioned = (el: Element) =>
    el.className.toString().split(/\s+/).includes("relative") || el.hasAttribute("data-positioned");
  return Array.from(root.querySelectorAll(".sr-only")).filter((el) => {
    for (let node = el.parentElement; node; node = node.parentElement) {
      if (isPositioned(node)) return false;
      if (node === root) return true;
    }
    return true;
  });
}
