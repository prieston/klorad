/**
 * Symmetric encryption for at-rest secrets (BYOK Anthropic keys etc.).
 *
 * AES-256-GCM via `node:crypto` — authenticated, IV per ciphertext.
 * The 32-byte key is sourced from `SECRETS_KEY`:
 *   - 64 hex chars → used as-is.
 *   - anything else → run through scrypt to derive 32 bytes.
 *
 * Format: `${iv}.${tag}.${ciphertext}`, all base64. The dot separator
 * is safe because base64 never contains `.`.
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const SCRYPT_SALT = "klorad-secrets-v1";

function getKey(): Buffer {
  const raw = process.env.SECRETS_KEY;
  if (!raw) {
    throw new Error(
      "SECRETS_KEY env var not set — required to encrypt at-rest secrets.",
    );
  }
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  return scryptSync(raw, SCRYPT_SALT, KEY_BYTES);
}

/** True when `SECRETS_KEY` is configured — callers can gate the UI on this. */
export function secretsEnabled(): boolean {
  return Boolean(process.env.SECRETS_KEY);
}

/** Encrypt a UTF-8 string. Throws if `SECRETS_KEY` isn't set. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

/** Decrypt a blob from `encryptSecret`. Throws on tampering / bad key. */
export function decryptSecret(blob: string): string {
  const [ivB64, tagB64, ctB64] = blob.split(".");
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error("Invalid ciphertext blob");
  }
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
    "utf8",
  );
}

/**
 * Display-safe representation of a secret — first 7 chars (catches
 * the `sk-ant-` prefix), then `…`, then four bullets, then last 4
 * chars. Never returned over the wire alongside the real value.
 */
export function maskSecret(value: string): string {
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 7)}…••••${value.slice(-4)}`;
}
