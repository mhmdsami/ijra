import { env } from "@/env";

const MAX_AGE_MS = 5 * 60_000;
const secretLike = /(?:token|secret|password|authorization|cookie|api[_-]?key|private[_-]?key)\s*[=:]\s*\S+/gi;

async function hmacHex(payload: string, key: string) {
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function validSignature(body: string, timestamp: string, signature: string) {
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > MAX_AGE_MS) return false;
  const expected = await hmacHex(`${timestamp}.${body}`, env().IJRA_RUNNER_KEY);
  if (signature.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function redactText(text: string) {
  return text.replace(secretLike, "[redacted]");
}
