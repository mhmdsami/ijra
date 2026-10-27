import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { validGithubSignature } from "./github-signature.ts";

const secret = "test-secret";
const body = JSON.stringify({ action: "closed" });
const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

test("accepts a valid GitHub signature", async () => {
  assert.equal(await validGithubSignature(body, signature, secret), true);
});

test("rejects a signature from another secret", async () => {
  assert.equal(await validGithubSignature(body, signature, "other-secret"), false);
});

test("rejects a modified body", async () => {
  assert.equal(await validGithubSignature(`${body} `, signature, secret), false);
});

test("rejects missing and malformed signatures", async () => {
  assert.equal(await validGithubSignature(body, "", secret), false);
  assert.equal(await validGithubSignature(body, "sha1=abc", secret), false);
  assert.equal(await validGithubSignature(body, "sha256=abc", secret), false);
});
