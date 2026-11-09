import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { COMMON_PASSWORDS } from "./data/commonPasswords";

/** scrypt on libuv's thread pool, so hashing never blocks other requests. */
function scryptAsync(password: string, salt: Buffer, keylen: number, opts: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/**
 * Password hashing with Node's built-in scrypt — no native bcrypt/argon2
 * dependency, sufficient at test-drive scale. A record is self-describing:
 *   scrypt:<saltHex>:<hashHex>
 * so the algorithm and salt travel with the hash and verification never needs
 * external parameters. scrypt cost params match the OWASP-recommended baseline
 * (N=16384, r=8, p=1), which are also Node's defaults.
 */
const COST = 16384; // N
const BLOCK_SIZE = 8; // r
const PARALLELIZATION = 1; // p
const KEY_LENGTH = 32;
const SALT_BYTES = 16;
// N * 2 * r * 64 bytes ≈ 16 MB working memory; give scrypt generous headroom.
const SCRYPT_OPTS = {
  cost: COST,
  blockSize: BLOCK_SIZE,
  parallelization: PARALLELIZATION,
  maxmem: 64 * 1024 * 1024,
} as const;

/** Hash a plaintext password into a `scrypt:<saltHex>:<hashHex>` record. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scryptAsync(password, salt, KEY_LENGTH, SCRYPT_OPTS);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Constant-time verification against a stored record. Returns false (never
 * throws) for a malformed or unrecognised record.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, saltHex = "", hashHex = ""] = parts;
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    if (salt.length === 0 || expected.length === 0) return false;
    const actual = await scryptAsync(password, salt, expected.length, SCRYPT_OPTS);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * `passwordHash` of an account that has no usable password yet (P18.7): created by the
 * super admin with a set-password link, until the user opens it. A record that
 * `verifyPassword` always rejects (it is not a three-part `scrypt:…` record), so no
 * typed password can ever log in to it.
 */
export const NO_PASSWORD = "none";

/** Shortest password the app accepts, on every form that sets one. */
export const MIN_PASSWORD_LENGTH = 10;

/** The common-password list as a set. Checked locally: no password ever leaves the server. */
const COMMON = new Set(COMMON_PASSWORDS.split("\n"));

/** Why a new password is refused, as an i18n key under `auth`; `null` when it is fine. */
export type PasswordProblem = "passwordTooShort" | "passwordCommon";

/**
 * The one rule for a new password (sign-up, reset, `/account`, the admin forms): long
 * enough, not on the common list, not a common word padded with digits or symbols
 * ("Welkom2026!"), and not one short unit repeated ("abcabcabcabc").
 */
export function passwordProblem(password: string): PasswordProblem | null {
  if (password.length < MIN_PASSWORD_LENGTH) return "passwordTooShort";
  const lower = password.toLowerCase();
  const core = lower.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  if (COMMON.has(lower) || (core.length >= 4 && COMMON.has(core))) return "passwordCommon";
  if (/^(.{1,4})\1+$/su.test(password)) return "passwordCommon";
  return null;
}
