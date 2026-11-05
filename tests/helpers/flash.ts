/**
 * The flash key a redirect Response carries (P16), read back through the real
 * `takeFlash`, or `null` when it sets none. Callers set `DATABASE_URL` before
 * importing server modules; this helper imports `flash.server` lazily.
 */
export async function flashKeyOf(res: unknown): Promise<string | null> {
  if (!(res instanceof Response)) return null;
  const line = res.headers.getSetCookie().find((c) => c.startsWith("__flash="));
  if (!line) return null;
  const { takeFlash } = await import("~/server/flash.server");
  const request = new Request("http://localhost/", { headers: { Cookie: line.split(";")[0] } });
  return (await takeFlash(request)).flash?.key ?? null;
}
