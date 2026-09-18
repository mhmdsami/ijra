import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeBase64Image, imageMetaError, signImage, verifyImageSignature, MAX_IMAGE_BYTES } from "./images.ts";

const pngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");

test("accepts a small png and rejects anything else", () => {
  const bytes = decodeBase64Image(pngBase64);
  assert.ok(bytes);
  assert.equal(imageMetaError("image/png", bytes), null);
  assert.match(imageMetaError("image/gif", bytes) ?? "", /png, jpeg, or webp/);
  assert.match(imageMetaError("image/png", new Uint8Array(0)) ?? "", /empty/);
  assert.match(imageMetaError("image/png", new Uint8Array(MAX_IMAGE_BYTES + 1)) ?? "", /under/);
});

test("rejects content that is not base64", () => {
  assert.equal(decodeBase64Image("not base64!!"), null);
});

test("signed urls verify, and fail when expired or tampered", async () => {
  const key = "test-key";
  const { exp, sig } = await signImage("image-1", key, Date.now() + 60_000);
  assert.equal(await verifyImageSignature("image-1", exp, sig, key), true);
  assert.equal(await verifyImageSignature("image-2", exp, sig, key), false);
  assert.equal(await verifyImageSignature("image-1", exp, sig, "other-key"), false);

  const expired = await signImage("image-1", key, Date.now() - 1_000);
  assert.equal(await verifyImageSignature("image-1", expired.exp, expired.sig, key), false);
  assert.equal(await verifyImageSignature("image-1", "not-a-number", sig, key), false);
});
