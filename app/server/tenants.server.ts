/**
 * One app, one database per institution (BESLUIT-2026-11-12-…, "pilot op twee databases").
 *
 * `TENANTS` lists the institutions: an id, the addresses it is served on and its SQLite file.
 * Every request runs on the institution of its address (`tenantMiddleware`, first in the root
 * middleware); `getDb()` then opens that institution's database. The database *is* the boundary:
 * nothing inside a database knows other institutions exist (docs/Tenancy-and-Admin.md).
 *
 * Without `TENANTS` the app is one instance on `DATABASE_URL`, exactly as before.
 *
 * The institution travels with the async context (AsyncLocalStorage), so work a request starts
 * and finishes later (a stream's save, a timer) stays on it. Outside a request (ops scripts,
 * timers) `LIMEONIT_TENANT` names it; with several institutions and no name, `currentTenant()`
 * throws instead of guessing, so nothing ever lands in the wrong database.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { dirname, join } from "node:path";
import type { MiddlewareFunction } from "react-router";
import { z } from "zod";
import { DB_PATH, env } from "./env.server";

export interface Tenant {
  /** Stable slug, also the database file name by default: `hsl`, `hhs`. */
  id: string;
  /** Host names (lowercase, no port) this institution is served on. Empty: every address. */
  hosts: string[];
  /** Filesystem path of its SQLite database (`:memory:` in tests). */
  dbPath: string;
}

const SINGLE_ID = "default";

const TenantsSchema = z
  .array(
    z.object({
      id: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/),
      hosts: z.array(z.string().min(1)).min(1),
      database: z.string().min(1).optional(),
    }),
  )
  .min(1);

const pathOf = (url: string) => url.replace(/^file:/, "");

function unique(values: string[], what: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`TENANTS: ${what} "${value}" is listed twice.`);
    seen.add(value);
  }
}

/**
 * The institutions in `raw` (the `TENANTS` JSON). Unset or blank: one instance on `dbPath`.
 * A database without `database` lives next to `dbPath` as `<id>.db`. Throws on anything that
 * could mix two institutions up: a bad id, an address or database listed twice.
 */
export function parseTenants(raw: string | undefined, dbPath: string): Tenant[] {
  if (!raw?.trim()) return [{ id: SINGLE_ID, hosts: [], dbPath }];
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("TENANTS is not valid JSON.");
  }
  const parsed = TenantsSchema.safeParse(json);
  if (!parsed.success) throw new Error(`TENANTS is invalid: ${parsed.error.message}`);
  const list = parsed.data.map((t) => ({
    id: t.id,
    hosts: t.hosts.map((h) => h.trim().toLowerCase()),
    dbPath: t.database
      ? pathOf(t.database)
      : dbPath.startsWith(":memory:")
        ? dbPath
        : join(dirname(dbPath), `${t.id}.db`),
  }));
  unique(
    list.map((t) => t.id),
    "institution",
  );
  unique(
    list.flatMap((t) => t.hosts),
    "address",
  );
  unique(
    list.map((t) => t.dbPath).filter((p) => !p.startsWith(":memory:")),
    "database",
  );
  return list;
}

const configured = parseTenants(env.TENANTS, DB_PATH);

/** Every institution this process serves (one, without `TENANTS`). */
export function allTenants(): readonly Tenant[] {
  return configured;
}

/** The institution served on `host` (case and port ignored); `null` for any other address. */
export function tenantForHost(host: string, list: readonly Tenant[] = configured): Tenant | null {
  const name = host.trim().toLowerCase().replace(/:\d+$/, "");
  if (list.length === 1 && list[0]?.hosts.length === 0) return list[0];
  if (!name) return null;
  return list.find((t) => t.hosts.includes(name)) ?? null;
}

const context = new AsyncLocalStorage<Tenant>();

/** Runs `work` (and everything it starts) on `tenant`'s database. */
export function runWithTenant<T>(tenant: Tenant, work: () => T): T {
  return context.run(tenant, work);
}

/** The institution this code runs for, or `null` when that cannot be told. Never throws. */
export function currentTenantOrNull(list: readonly Tenant[] = configured): Tenant | null {
  const inContext = context.getStore();
  if (inContext) return inContext;
  if (list.length === 1) return list[0] ?? null;
  const named = process.env.LIMEONIT_TENANT;
  return list.find((t) => t.id === named) ?? null;
}

/**
 * The institution this code runs for: the request's, else the only one, else the one
 * `LIMEONIT_TENANT` names. Throws when none applies, rather than pick a database.
 */
export function currentTenant(): Tenant {
  const tenant = currentTenantOrNull();
  if (tenant) return tenant;
  throw new Error(
    `No institution for this work: set LIMEONIT_TENANT to one of ${configured.map((t) => t.id).join(", ")}.`,
  );
}

const HEALTH_PATH = "/healthz";

const UNKNOWN_HOST = [
  "Dit adres hoort niet bij een instelling in LimeOnIt.",
  "This address does not belong to an institution on LimeOnIt.",
].join("\n");

/**
 * Root middleware: runs the request on the institution of its address, or answers 404 for an
 * address that belongs to none (and runs nothing else). Only `/healthz` runs on any address.
 */
export function tenantMiddleware(
  list: readonly Tenant[] = configured,
): MiddlewareFunction<Response> {
  return async ({ request }, next) => {
    const url = new URL(request.url);
    // The container's health check calls itself on 127.0.0.1; the probe checks every database.
    if (url.pathname === HEALTH_PATH) return next();
    const tenant = tenantForHost(url.host, list);
    if (!tenant) {
      return new Response(UNKNOWN_HOST, {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return runWithTenant(tenant, () => next());
  };
}

/** The root route's institution middleware, for the configured institutions. */
export const tenantRouting = tenantMiddleware();

/** The address `tenant` is served on (its first host, with `appOrigin`'s scheme), for links. */
export function tenantOrigin(tenant: Tenant, appOrigin: string): string {
  const [host] = tenant.hosts;
  return host ? `${new URL(appOrigin).protocol}//${host}` : appOrigin;
}
