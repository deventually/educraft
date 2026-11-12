/**
 * Server entry. Mirrors the React Router default streaming SSR handler, adding
 * baseline security headers (see securityHeaders.server) to every rendered
 * response — bot and browser branches share the single ready callback below —
 * and the request's CSP nonce to every inline script React and React Router write.
 */
import { PassThrough } from "node:stream";

import type { EntryContext, RouterContextProvider } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import type { RenderToPipeableStreamOptions } from "react-dom/server";
import { renderToPipeableStream } from "react-dom/server";
import { applySecurityHeaders, createCspNonce, cspNonceOf } from "~/server/securityHeaders.server";
import { ensureRegistryValidated } from "~/lib/registry/boot.server";
import { startAiUsageRetention } from "~/server/aiUsageRetention.server";
import { startBackupSchedule } from "~/server/backup.server";
import { migrateAllTenants } from "~/server/db.server";
import { handleServerError, recordError } from "~/server/errorLog.server";
import { requestIdOf } from "~/server/requestId.server";

export const streamTimeout = 5_000;

// Validate the tool registry once at server startup (Phase 5.5). In dev this
// throws on the first invalid tool (fail fast); in production it logs each issue
// and excludes the offending tool (via availability.server) so a single typo can
// never take the instance down.
ensureRegistryValidated();

// Every institution's database (TENANTS, or the one at DATABASE_URL) is opened and migrated at
// boot, so a bad migration or an unreachable volume fails here and not on a teacher's request.
migrateAllTenants();

// The app's own daily database backup (production, or wherever BACKUP_DIR is set). Online, so
// no downtime; a failure is logged and never takes the app down. See backup.server.
startBackupSchedule();

// AI use per person is kept thirteen months, then rolled up into totals without a person
// (BESLUIT-2026-11-11-6). Hourly, logged, never fatal. See aiUsageRetention.server.
startAiUsageRetention();

/** Unexpected loader/action/render errors: one JSON line with the request id (errorLog). */
export const handleError = handleServerError;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: RouterContextProvider,
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const userAgent = request.headers.get("user-agent");
    // Set by the root middleware; a render without it (no route matched) gets its own.
    const nonce = cspNonceOf(loadContext) ?? createCspNonce();

    // Wait for all content on bots/SPA (so meta/OG tags are present); stream the
    // shell as soon as it is ready for real users.
    const readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || routerContext.isSpaMode ? "onAllReady" : "onShellReady";

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} nonce={nonce} />,
      {
        nonce,
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");
          applySecurityHeaders(responseHeaders, { nonce });

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          // Log streaming errors only once the shell has rendered (before that, the
          // shell error rejects and React Router's handleError sees it).
          if (shellRendered) {
            recordError(error, {
              requestId: requestIdOf(loadContext),
              method: request.method,
              path: new URL(request.url).pathname,
            });
          }
        },
      },
    );

    // Abort the streaming render if it exceeds the deadline.
    setTimeout(abort, streamTimeout);
  });
}
