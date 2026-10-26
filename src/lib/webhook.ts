import { env } from "@/env";
import { verifySignature } from "./signature";

const secretLike = /(?:token|secret|password|authorization|cookie|api[_-]?key|private[_-]?key)\s*[=:]\s*\S+/gi;

export async function validSignature(body: string, timestamp: string, signature: string) {
  return verifySignature(body, timestamp, signature, env().IJRA_RUNNER_KEY);
}

export function redactText(text: string) {
  return text.replace(secretLike, "[redacted]");
}
