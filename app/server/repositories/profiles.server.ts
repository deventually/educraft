import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db.server";
import { contextProfiles } from "../schema.server";
import type { ContextProfile } from "~/lib/context/types";

function rowToProfile(row: typeof contextProfiles.$inferSelect): ContextProfile {
  const data = JSON.parse(row.dataJson) as Omit<ContextProfile, "id" | "name">;
  return { id: row.id, name: row.name, ...data };
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
