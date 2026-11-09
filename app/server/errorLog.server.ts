/**
 * Unexpected server errors (P1): one JSON line per error on stderr, carrying the
 * request id, plus the newest few in memory for the owner's "Recente fouten" page.
 * Kept in memory on purpose: no table, no migration, nothing to clean up. After a
 * restart the page starts empty; the full history stays in the server log, where
 * the request id finds the line.
 *
 * Metadata only, like `log.server`: method, path without its query string, the
 * error's name, message and stack (both capped). Never a request body.
 */
import { isRouteErrorResponse, type HandleErrorFunction } from "react-router";
import { requestIdOf } from "./requestId.server";

export const MAX_RECENT_ERRORS = 50;
const MAX_MESSAGE = 500;
const MAX_STACK_LINES = 20;

export interface ErrorEntry {
  requestId: string;
  at: string;
  method: string;
  path: string;
  name: string;
  message: string;
  stack: string;
}

export interface ErrorWhere {
  requestId: string | null;
  method: string;
  path: string;
}

let recent: ErrorEntry[] = [];

/** The newest errors first (a copy). */
export function recentErrors(): ErrorEntry[] {
  return [...recent];
}

/** Tests only: start from an empty list. */
export function clearRecentErrors(): void {
  recent = [];
}

function summarize(error: unknown): Pick<ErrorEntry, "name" | "message" | "stack"> {
  const err = error instanceof Error ? error : new Error(String(error));
  return {
    name: err.name || "Error",
    message: err.message.slice(0, MAX_MESSAGE),
    stack: (err.stack ?? "").split("\n").slice(0, MAX_STACK_LINES).join("\n"),
  };
}

/** Log one unexpected error as a JSON line and keep it for the owner's page. */
export function recordError(error: unknown, where: ErrorWhere): ErrorEntry {
  const entry: ErrorEntry = {
    requestId: where.requestId ?? "-",
    at: new Date().toISOString(),
    method: where.method,
    path: where.path.split("?")[0],
    ...summarize(error),
  };
  const { at, ...fields } = entry;
  console.error(JSON.stringify({ ts: at, event: "unexpected_error", ...fields }));
  recent = [entry, ...recent].slice(0, MAX_RECENT_ERRORS);
  return entry;
}

/** A thrown `Response`/`data()` is an answer (404, 403, redirect), not a bug. */
function isExpected(error: unknown): boolean {
  if (error instanceof Response || isRouteErrorResponse(error)) return true;
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { type?: unknown }).type === "DataWithResponseInit"
  );
}

/**
 * React Router's `handleError` (exported from entry.server): called for an error in
 * a loader, an action or while rendering. An aborted request (the user went away)
 * is not recorded.
 */
export const handleServerError: HandleErrorFunction = (error, { request, context }) => {
  if (request.signal.aborted || isExpected(error)) return;
  recordError(error, {
    requestId: requestIdOf(context),
    method: request.method,
    path: new URL(request.url).pathname,
  });
};
