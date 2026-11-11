import type { Route } from "./+types/healthz";
import { pingDb } from "~/server/db.server";
import { APP_VERSION } from "~/server/version.server";

/**
 * Public liveness/readiness probe for orchestrators (Docker healthcheck, Fly, a
 * load balancer). No auth, no secrets in the output — just a trivial DB probe.
 * 200 `{ ok: true, version }` when the database answers; 503 `{ ok: false }` otherwise. The
 * version lets `deploy/deploy.sh` see that the container it started is the one answering; the
 * repository is public, so it gives nothing away.
 */
export async function loader(_: Route.LoaderArgs) {
  try {
    pingDb();
    return Response.json({ ok: true, version: APP_VERSION });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
