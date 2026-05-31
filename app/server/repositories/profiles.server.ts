import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db.server";
import { contextProfiles } from "../schema.server";
import type { ContextProfile, PackFieldValue } from "~/lib/context/types";

/** Legacy hbo-i fields (pre-pack model) → the generic ICT packValues keys. */
interface LegacyIctData {
  architectureLayers?: string[];
  activities?: string[];
  hboiLevel?: number;
}

function migrateLegacy(data: Record<string, unknown>): Record<string, unknown> {
  const legacy = data as LegacyIctData;
  if (data.packValues || (!legacy.architectureLayers && !legacy.activities && !legacy.hboiLevel)) {
    return data;
  }
  const packValues: Record<string, PackFieldValue> = {};
  if (legacy.architectureLayers?.length) packValues.architectuurlagen = legacy.architectureLayers;
  if (legacy.activities?.length) packValues.activiteiten = legacy.activities;
  if (legacy.hboiLevel) packValues.beheersingsniveau = legacy.hboiLevel;
  const { architectureLayers, activities, hboiLevel, ...rest } = data as Record<string, unknown> &
    LegacyIctData;
  void architectureLayers;
  void activities;
  void hboiLevel;
  return { ...rest, packValues };
}

function rowToProfile(row: typeof contextProfiles.$inferSelect): ContextProfile {
  const data = migrateLegacy(JSON.parse(row.dataJson) as Record<string, unknown>);
  return { id: row.id, name: row.name, ...(data as Omit<ContextProfile, "id" | "name">) };
}

export function listProfiles(): ContextProfile[] {
  return db.select().from(contextProfiles).all().map(rowToProfile);
}

export function getProfile(id: string): ContextProfile | null {
  const row = db.select().from(contextProfiles).where(eq(contextProfiles.id, id)).get();
  return row ? rowToProfile(row) : null;
}

export function getDefaultProfile(): ContextProfile | null {
  const row = db.select().from(contextProfiles).where(eq(contextProfiles.isDefault, true)).get();
  return row ? rowToProfile(row) : null;
}

export function createProfile(
  input: Omit<ContextProfile, "id">,
  isDefault = false,
): ContextProfile {
  const id = randomUUID();
  const { name, ...rest } = input;
  if (isDefault) clearDefault();
  db.insert(contextProfiles)
    .values({
      id,
      name,
      dataJson: JSON.stringify(rest),
      isDefault,
      createdAt: new Date(),
    })
    .run();
  return { id, ...input };
}

export function updateProfile(id: string, input: Omit<ContextProfile, "id">, isDefault?: boolean) {
  const { name, ...rest } = input;
  if (isDefault) clearDefault();
  db.update(contextProfiles)
    .set({
      name,
      dataJson: JSON.stringify(rest),
      ...(isDefault === undefined ? {} : { isDefault }),
    })
    .where(eq(contextProfiles.id, id))
    .run();
}

export function deleteProfile(id: string) {
  db.delete(contextProfiles).where(eq(contextProfiles.id, id)).run();
}

function clearDefault() {
  db.update(contextProfiles).set({ isDefault: false }).run();
}
