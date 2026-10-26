import { env } from "@/env";
import { hmacHex } from "./github-signature";

const MAX_AGE_MS = 5 * 60_000;
const secretLike = /(?:token|secret|password|authorization|cookie|api[_-]?key|private[_-]?key)\s*[=:]\s*\S+/gi;

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
