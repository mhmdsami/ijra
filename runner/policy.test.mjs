import { test } from "node:test";
import assert from "node:assert/strict";
import { addUsage, branchFromTitle, classifyChanges, emptyUsage, glob } from "./policy.mjs";

const session = "054ecdbe-6db9-4d4f-91cf-a38deba645cb";

test("flags protected paths from the allowlist check", () => {
  const { reasons, protectedHits } = classifyChanges({
    changed: ["package.json", "src/app/page.tsx"],
    affected: ["package.json", "src/app/page.tsx"],
    changedLines: 10,
    safePaths: ["src/**"],
  });
  assert.deepEqual(protectedHits, ["package.json"]);
  assert.match(reasons.join("; "), /protected path/);
});

test("treats src/lib and app router API files as protected even inside src/**", () => {
  const { reasons, protectedHits, outsideZone } = classifyChanges({
    changed: ["src/lib/db.ts", "src/app/api/x/route.ts"],
    affected: ["src/lib/db.ts", "src/app/api/x/route.ts"],
    changedLines: 10,
    safePaths: ["src/**"],
  });
  assert.deepEqual(protectedHits, ["src/lib/db.ts", "src/app/api/x/route.ts"]);
  assert.deepEqual(outsideZone, []);
  assert.equal(reasons.length, 1);
});

test("flags files outside the allowlist", () => {
  const { outsideZone } = classifyChanges({
    changed: ["src/app/page.tsx", "scripts/deploy.mjs"],
    affected: ["src/app/page.tsx", "scripts/deploy.mjs"],
    changedLines: 10,
    safePaths: ["src/app/**"],
  });
  assert.deepEqual(outsideZone, ["scripts/deploy.mjs"]);
});

test("enforces the 12 file and 400 line limits", () => {
  const files = Array.from({ length: 13 }, (_, index) => `src/app/${index}.tsx`);
  assert.match(classifyChanges({ changed: files, affected: files, changedLines: 12, safePaths: ["src/**"] }).reasons.join("; "), /changed 13 files/);
  assert.match(classifyChanges({ changed: ["src/a.ts"], affected: ["src/a.ts"], changedLines: 401, safePaths: ["src/**"] }).reasons.join("; "), /changed 401 lines/);
  assert.deepEqual(classifyChanges({ changed: ["src/a.ts"], affected: ["src/a.ts"], changedLines: 400, safePaths: ["src/**"] }).reasons, []);
});

test("glob matches nested paths but not neighbours", () => {
  assert.equal(glob("src/app/**").test("src/app/page.tsx"), true);
  assert.equal(glob("src/app/**").test("src/app/nested/deep/page.tsx"), true);
  assert.equal(glob("src/app/**").test("src/lib/db.ts"), false);
  assert.equal(glob("src/*.ts").test("src/db.ts"), true);
  assert.equal(glob("src/*.ts").test("src/lib/db.ts"), false);
});

test("builds a short branch from the generated title", () => {
  assert.deepEqual(branchFromTitle("feat: add ijra route", session), {
    type: "feat",
    subject: "add ijra route",
    title: "feat: add ijra route",
    branch: "ft-054ecdbe-add-ijra-route",
  });
});

test("keeps the existing type prefixes", () => {
  assert.equal(branchFromTitle("fix: rename the users button", session).branch, "fx-054ecdbe-rename-the-users-button");
  assert.equal(branchFromTitle("refactor: split the runner", session).branch, "rf-054ecdbe-split-the-runner");
});

test("maps docs onto the chore prefix", () => {
  assert.equal(branchFromTitle("docs: describe policy", session).branch, "ch-054ecdbe-describe-policy");
});

test("falls back to chore when the title has no known type", () => {
  assert.equal(branchFromTitle("Update the readme", session).type, "chore");
  assert.equal(branchFromTitle("Update the readme", session).title, "chore: Update the readme");
});

test("strips trailing punctuation and caps the subject", () => {
  const { title, branch } = branchFromTitle(
    `fix: ${"a very long subject that keeps going past the fifty character cap for sure"}.`,
    session
  );
  assert.equal(title.endsWith("."), false);
  assert.ok(title.length <= "fix: ".length + 50);
  assert.ok(branch.length <= "fx-054ecdbe-".length + 32);
  assert.equal(branch.endsWith("-"), false);
});

test("accumulates usage and ignores invalid fields", () => {
  const total = emptyUsage();
  addUsage(total, { input: 100, output: 5, cacheRead: 20, cacheWrite: 1, totalTokens: 106, cost: { total: 0.01 } });
  addUsage(total, { input: -1, output: "x", cacheRead: undefined, cost: null });
  addUsage(total, null);
  assert.deepEqual(total, {
    input: 100,
    output: 5,
    cacheRead: 20,
    cacheWrite: 1,
    totalTokens: 106,
    costUsd: 0.01,
    modelCalls: 0,
  });
});
