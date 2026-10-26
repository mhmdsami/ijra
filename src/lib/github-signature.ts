export async function hmacHex(payload: string, key: string) {
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function validGithubSignature(body: string, header: string, secret: string) {
  if (!header.startsWith("sha256=")) return false;
  const signature = header.slice("sha256=".length).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = await hmacHex(body, secret);
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
