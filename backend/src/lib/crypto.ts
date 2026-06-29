import crypto from "crypto";
import bcrypt from "bcrypt";
import { env } from "../config/env";

const API_KEY_BCRYPT_ROUNDS = 12;

export function generateApiKey(): { keyId: string; secret: string; full: string } {
  const keyId = `ebx_${crypto.randomBytes(8).toString("hex")}`;
  const secret = crypto.randomBytes(32).toString("base64url");
  return { keyId, secret, full: `${keyId}.${secret}` };
}

export function parseApiKeyHeader(header: string | undefined): { keyId: string; secret: string } | null {
  if (!header) return null;
  const trimmed = header.trim();
  const idx = trimmed.indexOf(".");
  if (idx <= 0 || idx === trimmed.length - 1) return null;
  return { keyId: trimmed.slice(0, idx), secret: trimmed.slice(idx + 1) };
}

export async function hashApiKey(secret: string): Promise<string> {
  return bcrypt.hash(secret + env.API_KEY_PEPPER, API_KEY_BCRYPT_ROUNDS);
}

export async function verifyApiKey(secret: string, hash: string): Promise<boolean> {
  return bcrypt.compare(secret + env.API_KEY_PEPPER, hash);
}

export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export interface WebhookSignature {
  timestamp: number;
  signatureHeader: string; // X-Easybox-Signature value, e.g. "sha256=<hex>"
  timestampHeader: string; // X-Easybox-Timestamp value, unix seconds as string
}

export function signWebhookPayload(body: string, secret: string, now = Math.floor(Date.now() / 1000)): WebhookSignature {
  const signed = `${now}.${body}`;
  const hmac = crypto.createHmac("sha256", secret).update(signed).digest("hex");
  return {
    timestamp: now,
    signatureHeader: `sha256=${hmac}`,
    timestampHeader: String(now),
  };
}

export function verifyWebhookSignature(
  body: string,
  secret: string,
  signatureHeader: string | undefined,
  timestampHeader: string | undefined,
  toleranceSeconds = 300
): boolean {
  if (!signatureHeader || !timestampHeader) return false;
  const [scheme, hex] = signatureHeader.split("=");
  if (scheme !== "sha256" || !hex) return false;
  const t = Number(timestampHeader);
  if (!Number.isFinite(t)) return false;
  const skew = Math.abs(Math.floor(Date.now() / 1000) - t);
  if (skew > toleranceSeconds) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(hex, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function hashRequest(method: string, path: string, body: unknown): string {
  const serialized = `${method.toUpperCase()} ${path} ${JSON.stringify(body ?? null)}`;
  return crypto.createHash("sha256").update(serialized).digest("hex");
}
