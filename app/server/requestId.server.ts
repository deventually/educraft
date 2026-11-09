/**
 * One id per request (P1): the root middleware gives every request (page, data,
 * resource route) a fresh random id, puts it in the router context for the
 * error log, and returns it as the `X-Request-Id` response header. A teacher who
 * reports a problem can quote it; the owner finds the matching line in the log
 * and on "Recente fouten". An id the client sends is ignored: the server picks.
 */
import { createContext, type MiddlewareFunction, type RouterContextProvider } from "react-router";

export const REQUEST_ID_HEADER = "X-Request-Id";

/** The current request's id; `null` outside a request (no middleware ran). */
export const requestIdContext = createContext<string | null>(null);

export function requestIdOf(
  context: Pick<RouterContextProvider, "get"> | undefined,
): string | null {
  return context?.get(requestIdContext) ?? null;
}

function withHeader(response: Response, id: string): Response {
  try {
    response.headers.set(REQUEST_ID_HEADER, id);
    return response;
  } catch {
    // Immutable headers (`Response.redirect`, a proxied fetch): copy first.
    const copy = new Response(response.body, response);
    copy.headers.set(REQUEST_ID_HEADER, id);
    return copy;
  }
}

/** Root-route middleware: runs first, so every later step can read the id. */
export const requestIdMiddleware: MiddlewareFunction<Response> = async ({ context }, next) => {
  const id = crypto.randomUUID();
  context.set(requestIdContext, id);
  return withHeader(await next(), id);
};
