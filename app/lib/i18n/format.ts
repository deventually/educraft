/**
 * Interpolate single-brace placeholders in a UI string, e.g.
 *   fmt("Niveau {n}", { n: 2 }) // "Niveau 2"
 * Unknown placeholders are left untouched so missing data is visible, not silent.
 */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
