/**
 * The referral guide (P39.4), one instance setting. Repository rule (Phase 1): every export is
 * async; no better-sqlite3 API outside `db.server.ts`. Instance data, not owned by a user: only
 * an admin's action writes it (`/admin/organisation`), every signed-in teacher reads it.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../db.server";
import { instanceSettings } from "../schema.server";
import { parseReferralGuide, type ReferralGuide } from "~/lib/referrals/guide";

const KEY = "referralGuide";

/** The guide as the admin filled it in; never set, or unreadable, is empty. */
export async function getReferralGuide(): Promise<ReferralGuide> {
  const row = getDb().select().from(instanceSettings).where(eq(instanceSettings.key, KEY)).get();
  if (!row) return [];
  try {
    return parseReferralGuide(JSON.parse(row.valueJson));
  } catch {
    return [];
  }
}

/** Store the guide (validated again here); an empty guide deletes the setting. */
export async function setReferralGuide(guide: ReferralGuide): Promise<void> {
  const db = getDb();
  const clean = parseReferralGuide(guide);
  if (clean.length === 0) {
    db.delete(instanceSettings).where(eq(instanceSettings.key, KEY)).run();
    return;
  }
  const valueJson = JSON.stringify(clean);
  db.insert(instanceSettings)
    .values({ key: KEY, valueJson, updatedAt: new Date() })
    .onConflictDoUpdate({ target: instanceSettings.key, set: { valueJson, updatedAt: new Date() } })
    .run();
}
