import { hmacHex } from "./github-signature.ts";

export const SIGNATURE_MAX_AGE_MS = 5 * 60_000;

export async function verifySignature(
  body: string,
  timestamp: string,
  signature: string,
  secret: string,
  now = Date.now()
) {
  if (!/^\d+$/.test(timestamp)) return false;
  if (Math.abs(now - Number(timestamp)) > SIGNATURE_MAX_AGE_MS) return false;
  const expected = await hmacHex(`${timestamp}.${body}`, secret);
  const received = signature.toLowerCase();
  if (received.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
