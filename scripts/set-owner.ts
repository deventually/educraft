/**
 * Ops script: make an existing admin the instance's super admin (owner, P18.6).
 *
 *   npm run set-owner -- --email jane@school.nl
 *
 * Only the super admin promotes teachers to admin, demotes or deletes admins. There
 * is one owner per instance; running this again hands ownership to another admin.
 * Refuses an unknown e-mail address or an account that is not an admin. The key is
 * read per request, so the app may be running. Relative imports (not the `~` alias)
 * keep it runnable under plain tsx, matching db:migrate / invite / create-admin.
 */
import { getUserByEmail } from "../app/server/repositories/users.server";
import { setOwnerUserId } from "../app/server/repositories/settings.server";

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = "true";
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const email = (args.email ?? "").trim();

if (!email || email === "true") {
  console.error("Missing --email. Usage: npm run set-owner -- --email jane@school.nl");
  process.exit(1);
}

const user = (await getUserByEmail(email)) ?? (await getUserByEmail(email.toLowerCase()));
if (!user) {
  console.error(`No account with email ${email}.`);
  process.exit(1);
}
if (user.role !== "admin") {
  console.error(
    `${email} is a ${user.role}, not an admin. Only an admin can be the super admin: ` +
      "make them an admin first (npm run create-admin, or ask the current super admin to promote them).",
  );
  process.exit(1);
}

await setOwnerUserId(user.id);
console.log(`✓ Super admin set: ${user.name} <${user.email}> (id: ${user.id}).`);
