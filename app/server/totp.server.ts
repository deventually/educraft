/**
 * Two-step verification with an authenticator app (P2-12): TOTP per RFC 6238 (HMAC-SHA1,
 * 6 digits, 30-second steps) and single-use recovery codes. Pure functions on `node:crypto`;
 * storage lives in `repositories/twoFactor.server.ts`.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_MS = 30_000;
const DIGITS = 6;

/** RFC 4648 base32, without padding (the form authenticator apps expect). */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** Decode base32, ignoring case, spaces and padding. Unknown characters are skipped. */
export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) continue;
    value = ((value << 5) | index) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A fresh 160-bit secret, base32 (32 characters). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The six-digit code of time step `step` (RFC 4226 dynamic truncation). */
export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const binary = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Check a typed code against the current step and one either side (clock drift). Returns the
 * matching step, or `null`. A step at or before `lastStep` is refused: a code works once.
 */
export function verifyTotp(
  secret: string,
  typed: string,
  { now = Date.now(), lastStep = -1 }: { now?: number; lastStep?: number } = {},
): number | null {
  const code = typed.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / STEP_MS);
  for (const step of [current - 1, current, current + 1]) {
    if (step <= lastStep) continue;
    if (timingSafeEqual(Buffer.from(totpCode(secret, step)), Buffer.from(code))) return step;
  }
  return null;
}

/** The `otpauth://` link a QR code carries; `label` is usually the e-mail address. */
export function otpauthUri(secret: string, label: string, issuer: string): string {
  const params = `secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=30`;
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?${params}`;
}

/** `count` single-use recovery codes, `xxxxx-xxxxx` (50 random bits each). */
export function generateRecoveryCodes(count = 10): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    const raw = base32Encode(randomBytes(7)).slice(0, 10).toLowerCase();
    codes.add(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return [...codes];
}

/** A typed recovery code without case, spaces or dashes. */
export function normalizeRecoveryCode(typed: string): string {
  return typed.toLowerCase().replace(/[\s-]/g, "");
}

/** Stored form of a recovery code: SHA-256 is enough for 50 random bits used once. */
export function hashRecoveryCode(typed: string): string {
  return createHash("sha256").update(normalizeRecoveryCode(typed)).digest("hex");
}
