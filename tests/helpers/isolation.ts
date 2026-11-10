/**
 * Whether a test file needs a fresh module graph of its own (`isolate: true`), judged from its
 * source. Every other file runs in a shared project (`isolate: false`), where the app's modules
 * load once per worker instead of once per file.
 *
 * A file needs its own modules when it
 * - mocks a module (`vi.mock`): a module imported under that mock would stay cached for the next
 *   file;
 * - sets an environment variable or stubs one (`vi.stubEnv`): `env.server` reads them once, at
 *   import, so the next file would see this file's values;
 * - points the database at a file: `env.server` fixes the database path at import as well.
 *
 * The in-memory database is the exception: every project already sets it.
 */
const NEEDS_OWN_MODULES = [
  /\bvi\.mock\(/,
  /\bvi\.stubEnv\(/,
  /\bprocess\.env\.(?!DATABASE_URL (\?\?)?= "file::memory:")\w+ *(\?\?)?=(?!=)/,
  /\bDATABASE_URL(: | = )`file:/,
];

export function needsIsolation(source: string): boolean {
  return NEEDS_OWN_MODULES.some((pattern) => pattern.test(source));
}
