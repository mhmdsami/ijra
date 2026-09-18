import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const runner = resolve(dirname(fileURLToPath(import.meta.url)), "run-request.mjs");

test("runner evaluates its module scope and fails on the empty request guard", () => {
  const result = spawnSync(process.execPath, [runner], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      REQUEST: "",
      APP_ID: "",
      APP_PRIVATE_KEY: "",
      IJRA_WEBHOOK_URL: "https://example.test/api/internal/answer",
      IJRA_PROGRESS_URL: "https://example.test/api/internal/progress",
      IJRA_RUNNER_KEY: "test-key",
    },
  });
  const output = `${result.stdout}${result.stderr}`;
  assert.match(output, /REQUEST is empty/);
  assert.doesNotMatch(output, /ReferenceError|before initialization/);
  assert.doesNotMatch(output, /Cannot access/);
});
