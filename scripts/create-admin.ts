/**
 * Ops script: create an admin account directly (admins are never minted by an
 * invite link — see docs/Tenancy-and-Admin.md).
 *
 *   npm run create-admin -- --name "Jane Roe" --email jane@school.nl --password "correct horse battery staple"
 *
 * If `--password` is omitted a strong one is generated and printed once. The
 * account can then sign in at APP_ORIGIN/login. Relative imports (not the `~`
 * alias) keep it runnable under plain tsx, matching db:migrate / invite.
 *
 * Multi-tenancy note: under the planned database-per-tenant model this same
 * primitive is what the control-plane super-user calls to seed a new tenant's
 * first admin — the tenant DB is the boundary, so "admin" here always means
 * "admin of this instance/tenant". See docs/Tenancy-and-Admin.md.
 */
import { randomBytes } from "node:crypto";
import { createUser, getUserByEmail } from "../app/server/repositories/users.server";
import { hashPassword } from "../app/server/password.server";
import { env } from "../app/server/env.server";

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

/** A readable, high-entropy fallback password (base64url of 18 random bytes). */
function generatePassword(): string {
  return randomBytes(18).toString("base64url");
}

const args = parseArgs(process.argv.slice(2));

const name = (args.name ?? "").trim();
const email = (args.email ?? "").trim().toLowerCase();
const generated = !args.password;
const password = args.password ?? generatePassword();

if (!name) {
  console.error('Missing --name. Usage: npm run create-admin -- --name "Jane Roe" --email jane@school.nl');
  process.exit(1);
}
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(`Invalid or missing --email "${args.email ?? ""}". An admin signs in with an email + password.`);
  process.exit(1);
}
if (password.length < 10) {
  console.error("--password must be at least 10 characters.");
  process.exit(1);
}

const existing = await getUserByEmail(email);
if (existing) {
  console.error(
    `A user with email ${email} already exists (role: ${existing.role}). ` +
      "Promote them to admin from the admin console instead of re-creating.",
  );
  process.exit(1);
}

const user = await createUser({
  name,
  email,
  passwordHash: hashPassword(password),
  role: "admin",
});

console.log(`✓ Admin account created: ${name} <${email}> (id: ${user.id}).`);
if (generated) {
  console.log(`  Generated password (store it now — it is not recoverable): ${password}`);
}
console.log(`  Sign in at: ${env.APP_ORIGIN}/login`);
