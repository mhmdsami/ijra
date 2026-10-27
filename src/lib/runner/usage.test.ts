import assert from "node:assert/strict";
import { test } from "node:test";
import { formatCost, formatTokens, parseUsage } from "./usage.ts";

test("parses a full usage block", () => {
  assert.deepEqual(
    parseUsage({
      input: 1200,
      output: 300,
      cacheRead: 400,
      cacheWrite: 20,
      totalTokens: 1920,
      costUsd: 0.0042,
      modelCalls: 7,
    }),
    { input: 1200, output: 300, cacheRead: 400, cacheWrite: 20, totalTokens: 1920, costUsd: 0.0042, modelCalls: 7 },
  );
});

test("accepts a nested cost object and rejects bad values", () => {
  assert.equal(parseUsage({ input: 10, cost: { total: 0.5 } }).costUsd, 0.5);
  assert.deepEqual(parseUsage({ input: -5, output: "x", modelCalls: 2.9 }), {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    costUsd: 0,
    modelCalls: 2,
  });
});

test("defaults to zeros for missing or malformed input", () => {
  const zero = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, costUsd: 0, modelCalls: 0 };
  assert.deepEqual(parseUsage(undefined), zero);
  assert.deepEqual(parseUsage("nope"), zero);
  assert.deepEqual(parseUsage([]), zero);
});

test("formats tokens and cost", () => {
  assert.equal(formatTokens(950), "950");
  assert.equal(formatTokens(1200), "1.2k");
  assert.equal(formatTokens(2_400_000), "2.4M");
  assert.equal(formatCost(0), "$0");
  assert.equal(formatCost(0.0042), "$0.0042");
  assert.equal(formatCost(1.5), "$1.50");
});
