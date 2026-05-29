/** Values accepted for placeholder substitution. */
export type TemplateValue = string | number | boolean | string[] | null | undefined;
export type TemplateValues = Record<string, TemplateValue>;

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Return the set of placeholder names referenced in a template. */
export function placeholdersIn(template: string): string[] {
  const names = new Set<string>();
  for (const m of template.matchAll(PLACEHOLDER_RE)) names.add(m[1]);
  return [...names];
}

function render(value: TemplateValue): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join("\n");
  return String(value);
}

export interface InterpolateOptions {
  /**
   * Placeholder names allowed to be missing/empty (rendered as ""). Used for
   * injected vars like `contextProfile` or `previousOutput` that may be absent.
   */
  allowEmpty?: string[];
}

/**
 * Replace every {{name}} in `template` with the corresponding value.
 * Throws on any placeholder that has no value and is not in `allowEmpty`,
 * so missing mappings fail loudly (caught by tests and at request time).
 */
export function interpolate(
  template: string,
  values: TemplateValues,
  opts: InterpolateOptions = {},
): string {
  const allowEmpty = new Set(opts.allowEmpty ?? []);
  const missing: string[] = [];

  const result = template.replace(PLACEHOLDER_RE, (_match, name: string) => {
    const has = Object.hasOwn(values, name);
    if (!has && !allowEmpty.has(name)) {
      missing.push(name);
      return "";
    }
    return render(values[name]);
  });

  if (missing.length) {
    throw new Error(
      `Missing template values for: ${[...new Set(missing)].join(", ")}`,
    );
  }
  return result;
}
