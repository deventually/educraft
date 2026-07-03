import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const hash = scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTS);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Constant-time verification against a stored record. Returns false (never
 * throws) for a malformed or unrecognised record.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, saltHex, hashHex] = parts;
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    if (salt.length === 0 || expected.length === 0) return false;
    const actual = scryptSync(password, salt, expected.length, SCRYPT_OPTS);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
