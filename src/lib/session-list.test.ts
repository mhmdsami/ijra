import assert from "node:assert/strict";
import { test } from "node:test";
import { escapeLike, SESSIONS_PAGE_MAX, SESSIONS_PAGE_SIZE } from "./session-list.ts";

test("escapes LIKE wildcards", () => {
  assert.equal(escapeLike("100% done"), "100\\% done");
  assert.equal(escapeLike("a_b"), "a\\_b");
  assert.equal(escapeLike("back\\slash"), "back\\\\slash");
  assert.equal(escapeLike("plain"), "plain");
});

test("page constants are bounded", () => {
  assert.equal(SESSIONS_PAGE_SIZE, 30);
  assert.ok(SESSIONS_PAGE_MAX >= SESSIONS_PAGE_SIZE);
});
