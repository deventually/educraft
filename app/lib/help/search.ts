/**
 * Search on /help. No AI: the words of the query against each page's text, ranked like the
 * tool search. A hit also names the headings of that page that hold a word of the query, so
 * the teacher lands on the right paragraph.
 */
import { searchTools } from "~/lib/registry/search";

interface Heading {
  text: string;
  anchor: string;
}

interface HelpSearchItem {
  href: string;
  title: string;
  /** Lower-case text the page is searched by. */
  search: string;
  headings: Heading[];
}

/** Lower case without accents, so "ü" finds "u". */
const fold = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

export function searchHelp(items: readonly HelpSearchItem[], query: string) {
  const q = fold(query).trim();
  if (q === "") return [];
  const words = q.split(/\s+/).filter((w) => w.length > 1);
  const folded = items.map((item) => ({
    item,
    search: fold(`${item.title} ${item.search}`),
  }));
  return searchTools(folded, q).map(({ item }) => ({
    href: item.href,
    title: item.title,
    headings: item.headings.filter((h) => words.some((w) => fold(h.text).includes(w))),
  }));
}
