import type { Route } from "./+types/api.ai-limit";
import { requireUser } from "~/server/auth.server";
import { aiLimitFor } from "~/server/aiLimits.server";

/**
 * Resource route (no UI): the caller's monthly AI limit as a share, never in euros (PR D),
 * so the app can warn with a toast when an AI call crosses 80% or 100%.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { limit: await aiLimitFor(user) };
}
