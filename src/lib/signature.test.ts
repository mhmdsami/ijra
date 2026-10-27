import assert from "node:assert/strict";
import { test } from "node:test";
import { hmacHex } from "./github-signature.ts";
import { SIGNATURE_MAX_AGE_MS, verifySignature } from "./signature.ts";

const secret = "test-runner-key";
const body = JSON.stringify({ runId: "run-1", status: "failed" });

async function sign(timestamp: number, payload = body) {
  return hmacHex(`${timestamp}.${payload}`, secret);
}

test("accepts a fresh signature over the timestamp and body", async () => {
  const timestamp = 1_760_000_000_000;
  assert.equal(await verifySignature(body, String(timestamp), await sign(timestamp), secret, timestamp + 1_000), true);
});

test("applies a lowercase comparison so hex case does not matter", async () => {
  const timestamp = 1_760_000_000_000;
  const signature = await sign(timestamp);
  assert.equal(await verifySignature(body, String(timestamp), signature.toUpperCase(), secret, timestamp), true);
});

test("rejects a signature older than the freshness window", async () => {
  const timestamp = 1_760_000_000_000;
  const signature = await sign(timestamp);
  assert.equal(
    await verifySignature(body, String(timestamp), signature, secret, timestamp + SIGNATURE_MAX_AGE_MS + 1),
    false,
  );
});

test("rejects a signature from the future beyond the window", async () => {
  const timestamp = 1_760_000_000_000;
  const signature = await sign(timestamp);
  assert.equal(
    await verifySignature(body, String(timestamp), signature, secret, timestamp - SIGNATURE_MAX_AGE_MS - 1),
    false,
  );
});

test("rejects a tampered body", async () => {
  const timestamp = 1_760_000_000_000;
  const signature = await sign(timestamp);
  assert.equal(await verifySignature('{"runId":"run-2"}', String(timestamp), signature, secret, timestamp), false);
});

test("rejects a signature made with another secret", async () => {
  const timestamp = 1_760_000_000_000;
  const signature = await hmacHex(`${timestamp}.${body}`, "another-secret");
  assert.equal(await verifySignature(body, String(timestamp), signature, secret, timestamp), false);
});

test("rejects a malformed signature or timestamp", async () => {
  const timestamp = 1_760_000_000_000;
  assert.equal(await verifySignature(body, "not-a-number", await sign(timestamp), secret, timestamp), false);
  assert.equal(await verifySignature(body, String(timestamp), "abc", secret, timestamp), false);
  assert.equal(await verifySignature(body, String(timestamp), "", secret, timestamp), false);
});
