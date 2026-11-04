/** Display helpers for the workplace screens. */
export function fmtDate(d: Date | string | number, locale: string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString(locale === "en" ? "en-GB" : "nl-NL", { dateStyle: "medium" });
}

/** "LU1 Doceren", or just the title when the code is empty. */
export function outcomeLabel(o: { code: string; title: string }): string {
  return o.code ? `${o.code} ${o.title}` : o.title;
}
