import { test } from "node:test";
import assert from "node:assert/strict";
import { titleFrom } from "./title.ts";

test("keeps short requests as-is", () => {
  assert.equal(titleFrom("hi"), "hi");
  assert.equal(titleFrom("  Rename the Users button  "), "Rename the Users button");
});

test("collapses newlines and repeated whitespace", () => {
  assert.equal(titleFrom("image missing\n\nin the About Us\t section"), "image missing in the About Us section");
});

test("truncates long requests at a word boundary", () => {
  const title = titleFrom("How does the runner decide whether a pull request is safe to open, and where in the code is that enforced?");
  assert.equal(title, "How does the runner decide whether a pull request is safe…");
  assert.ok(title.length <= 61);
});

test("never splits a word when no early boundary exists", () => {
  const title = titleFrom("a".repeat(200));
  assert.equal(title, "a".repeat(60) + "…");
});

test("handles empty input", () => {
  assert.equal(titleFrom("   \n  "), "");
});
