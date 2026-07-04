import type { Route } from "./+types/healthz";
import { pingDb } from "~/server/db.server";

/**
 * Public liveness/readiness probe for orchestrators (Docker healthcheck, Fly, a
 * load balancer). No auth, no secrets in the output — just a trivial DB probe.
 * 200 `{ ok: true }` when the database answers; 503 `{ ok: false }` otherwise.
 */
export async function loader(_: Route.LoaderArgs) {
  try {
    pingDb();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
