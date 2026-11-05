/**
 * The route gate for a part of the app (P28.3): the signed-in user, or a 404 when the
 * part is off for them (`effectiveFeatures`). Switching off deletes nothing.
 */
import type { FeatureId } from "~/lib/features";
import { requireUser, type User } from "./auth.server";
import { requireFeature } from "./availability.server";

export async function requireFeatureUser(request: Request, id: FeatureId): Promise<User> {
  const user = await requireUser(request);
  await requireFeature(user, id);
  return user;
}
