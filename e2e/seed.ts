/**
 * Fresh database for the browser tests: migrate and create one teacher and one admin.
 * Run by the Playwright web server before the app starts (DATABASE_URL points at e2e/.data).
 */
import { rmSync } from "node:fs";
import { hashPassword } from "../app/server/password.server";
import { DB_PATH } from "../app/server/env.server";
import { USERS } from "./users";

if (!DB_PATH.includes("e2e")) throw new Error(`Refusing to seed a non-e2e database: ${DB_PATH}`);
for (const suffix of ["", "-wal", "-shm"]) rmSync(`${DB_PATH}${suffix}`, { force: true });

const { createUser } = await import("../app/server/repositories/users.server");
for (const [role, user] of Object.entries(USERS)) {
  await createUser({
    name: user.name,
    email: user.email,
    passwordHash: await hashPassword(user.password),
    role: role as keyof typeof USERS,
  });
}
console.log(`✓ e2e database seeded: ${DB_PATH}`);
