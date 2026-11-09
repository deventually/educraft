/**
 * Ops script: turn off someone's two-step verification (P2-12), for the owner who lost both
 * the phone and the recovery codes. (Anyone else asks the owner, who does it on the person's
 * page.) The person then logs in with only a password; an admin is asked to set it up again.
 *
 *   npm run reset-2fa -- --email jane@school.nl
 *   node build/ops/reset-2fa.js --email jane@school.nl
 *
 * Writes a line in the audit log ("via the server"). Relative imports (not the `~` alias)
 * keep it runnable under plain tsx, matching set-owner / create-admin.
 */
import { getUserByEmail } from "../app/server/repositories/users.server";
import { removeTwoFactor } from "../app/server/repositories/twoFactor.server";
import { recordAdminAction } from "../app/server/repositories/auditLog.server";

const at = process.argv.indexOf("--email");
const email = (at >= 0 ? (process.argv[at + 1] ?? "") : "").trim();

if (!email || email.startsWith("--")) {
  console.error("Missing --email. Usage: npm run reset-2fa -- --email jane@school.nl");
  process.exit(1);
}

const user = (await getUserByEmail(email)) ?? (await getUserByEmail(email.toLowerCase()));
if (!user) {
  console.error(`No account with email ${email}.`);
  process.exit(1);
}

if (!(await removeTwoFactor(user.id))) {
  console.log(`Two-step verification was already off for ${user.name} <${user.email}>.`);
  process.exit(0);
}
await recordAdminAction({
  actorUserId: user.id,
  action: "twoFactorReset",
  targetUserId: user.id,
  detail: { via: "server" },
});
console.log(
  `✓ Two-step verification turned off for ${user.name} <${user.email}>. ` +
    "They log in with their password and set it up again.",
);
