// Cifrado del token de Gmail (AES-256-GCM). Solo servidor.
// La llave vive en GMAIL_TOKEN_KEY (32 bytes en base64): `openssl rand -base64 32`.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

function key(): Buffer {
  const raw = process.env.GMAIL_TOKEN_KEY?.trim();
  if (!raw) throw new Error("gmail_not_configured");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("GMAIL_TOKEN_KEY debe tener 32 bytes en base64 (openssl rand -base64 32)");
  return k;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(blob: string): string {
  const [version, iv, tag, data] = blob.split(".");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("token_invalido");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
