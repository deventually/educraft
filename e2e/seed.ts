/**
 * Fresh database for the browser tests: migrate and create one teacher and one admin. The admin
 * has two-step verification on (required, P2-12); its secret goes to `e2e/.data/admin-totp`,
 * where `auth.setup.ts` reads it to sign in.
 * Run by the Playwright web server before the app starts (DATABASE_URL points at e2e/.data).
 */
import { rmSync, writeFileSync } from "node:fs";
import { hashPassword } from "../app/server/password.server";
import { DB_PATH } from "../app/server/env.server";
import { ADMIN_TOTP_FILE, USERS } from "./users";

if (!DB_PATH.includes("e2e")) throw new Error(`Refusing to seed a non-e2e database: ${DB_PATH}`);
for (const suffix of ["", "-wal", "-shm"]) rmSync(`${DB_PATH}${suffix}`, { force: true });

const { createUser, getUserByEmail } = await import("../app/server/repositories/users.server");
const twoFactor = await import("../app/server/repositories/twoFactor.server");
const { totpCode } = await import("../app/server/totp.server");
for (const [role, user] of Object.entries(USERS)) {
  const row = await createUser({
    name: user.name,
    email: user.email,
    passwordHash: await hashPassword(user.password),
    role: role as keyof typeof USERS,
  });
  if (role !== "admin") continue;
  const secret = (await twoFactor.startTwoFactorSetup(row.id)) ?? "";
  // One step back, so the sign-in in auth.setup.ts can use the current one.
  await twoFactor.confirmTwoFactorSetup(
    row.id,
    totpCode(secret, Math.floor(Date.now() / 30_000) - 1),
  );
  writeFileSync(ADMIN_TOTP_FILE, secret);
}
// One warning for everyone, so axe and the reflow check see the banner on every page.
const { createAnnouncement } = await import("../app/server/repositories/announcements.server");
await createAnnouncement({
  message: "Vanavond tussen 20.00 en 22.00 uur is LimeOnIt niet bereikbaar door onderhoud.",
  level: "warning",
  audience: { kind: "all" },
  endsOn: null,
  remindAfterDays: null,
  createdBy: (await getUserByEmail(USERS.admin.email))?.id ?? "",
});
// A dossier with guided writing for the admin (portfolio-guided.spec.ts), anchored to a lesson.
const { createDossier } = await import("../app/server/repositories/portfolio.server");
const { createCourse } = await import("../app/server/repositories/courses.server");
const { E2E_DOSSIER, anchoredCourse, guidedDossier } = await import("./seedDossier");
const adminId = (await getUserByEmail(USERS.admin.email))?.id ?? "";
const anchored = await createCourse(adminId, { name: "Rekenen (e2e)", data: anchoredCourse() });
await createDossier(adminId, E2E_DOSSIER, guidedDossier(anchored.id));
// The internship and thesis tracks (P38) are off for everyone; on request, and on for the teacher.
const settings = await import("../app/server/repositories/settings.server");
const exceptions = await import("../app/server/repositories/exceptions.server");
await settings.setFeatureStand("supervisionTracks", "request");
const teacherId = (await getUserByEmail(USERS.teacher.email))?.id ?? "";
await exceptions.setException(teacherId, exceptions.featureKey("supervisionTracks"), "on");
console.log(`✓ e2e database seeded: ${DB_PATH}`);
