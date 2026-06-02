import type { Route } from "./+types/devtools-probe";

/**
 * Resource route (no UI) answering Chrome DevTools' automatic probe for
 * `/.well-known/appspecific/com.chrome.devtools.json`. Chrome requests this on
 * every DevTools open to discover a workspace config; without a matching route
 * React Router logs a noisy "No route matches URL" error. We have no workspace
 * to advertise, so reply 204 No Content to keep the dev console clean.
 */
export function loader(_: Route.LoaderArgs) {
  return new Response(null, { status: 204 });
}
