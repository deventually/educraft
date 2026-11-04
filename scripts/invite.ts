/**
 * Ops script: mint a teacher invite link. Invites make teachers only (P18.6): an
 * admin is made with `npm run create-admin`, or by the super admin's promotion.
 *
 *   npm run invite -- --note "Jan de Vries" [--expires-days 14]
 *
 * Prints the absolute invite URL (using APP_ORIGIN). The admin UI mints the same
 * invites; the script stays for headless ops. Relative imports (not the `~`
 * alias) keep it runnable under plain tsx, matching db:migrate.
 */
import { createInvite } from "../app/server/repositories/users.server";
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

const args = parseArgs(process.argv.slice(2));

if (args.role !== undefined && args.role !== "teacher") {
  console.error(
    "Uitnodigingen maken alleen docenten. Een beheerder maak je met npm run create-admin " +
      "of via promotie door de superbeheerder.",
  );
  process.exit(1);
}

const note = args.note ?? null;
const expiresDays = args["expires-days"] ? Number(args["expires-days"]) : null;
if (expiresDays !== null && (!Number.isFinite(expiresDays) || expiresDays <= 0)) {
  console.error(`Invalid --expires-days "${args["expires-days"]}". Use a positive number of days.`);
  process.exit(1);
}
const expiresAt = expiresDays ? new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000) : null;

const invite = await createInvite({ role: "teacher", note, expiresAt });

console.log(`✓ Invite minted (role: teacher${note ? `, note: ${note}` : ""}).`);
if (expiresAt) console.log(`  Expires: ${expiresAt.toISOString()}`);
console.log(`${env.APP_ORIGIN}/invite/${invite.token}`);
