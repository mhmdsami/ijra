export const MAX_IMAGES_PER_MESSAGE = 3;
export const MAX_IMAGE_BYTES = 1_500_000;
export const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
const SIGNED_URL_TTL_MS = 30 * 60_000;

export function decodeBase64Image(data: string): Uint8Array | null {
  try {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export function imageMetaError(mime: string, bytes: Uint8Array) {
  if (!IMAGE_MIME_TYPES.includes(mime)) return "images must be png, jpeg, or webp";
  if (bytes.length === 0) return "image is empty";
  if (bytes.length > MAX_IMAGE_BYTES) return `images must be under ${Math.round(MAX_IMAGE_BYTES / 1000)}KB`;
  return null;
}

async function hmac(payload: string, key: string) {
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signImage(id: string, key: string, expiresAt = Date.now() + SIGNED_URL_TTL_MS) {
  const exp = String(expiresAt);
  return { exp, sig: await hmac(`${id}.${exp}`, key) };
}

export async function verifyImageSignature(id: string, exp: string, sig: string, key: string) {
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return constantTimeEqual(sig, await hmac(`${id}.${exp}`, key));
}
