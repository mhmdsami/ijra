import assert from "node:assert/strict";
import { test } from "node:test";
import { securityHeaders } from "./security-headers.ts";

function header(headers: { key: string; value: string }[], key: string) {
  return headers.find((entry) => entry.key === key)?.value ?? null;
}

test("production CSP locks down framing, plugins, and base URLs", () => {
  const csp = header(securityHeaders(false), "Content-Security-Policy");
  assert.ok(csp);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /form-action 'self'/);
});

test("production CSP does not need eval or websockets", () => {
  const csp = header(securityHeaders(false), "Content-Security-Policy");
  assert.doesNotMatch(csp ?? "", /unsafe-eval/);
  assert.doesNotMatch(csp ?? "", /ws:/);
  assert.match(csp ?? "", /upgrade-insecure-requests/);
});

test("development keeps eval and websockets for hot reload", () => {
  const csp = header(securityHeaders(true), "Content-Security-Policy");
  assert.match(csp ?? "", /unsafe-eval/);
  assert.match(csp ?? "", /ws:/);
  assert.doesNotMatch(csp ?? "", /upgrade-insecure-requests/);
});

test("HSTS is production only", () => {
  assert.equal(header(securityHeaders(false), "Strict-Transport-Security"), "max-age=63072000; includeSubDomains");
  assert.equal(header(securityHeaders(true), "Strict-Transport-Security"), null);
});

test("baseline headers are always present", () => {
  const headers = securityHeaders(false);
  assert.equal(header(headers, "X-Content-Type-Options"), "nosniff");
  assert.equal(header(headers, "X-Frame-Options"), "DENY");
  assert.equal(header(headers, "Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.match(header(headers, "Permissions-Policy") ?? "", /camera=\(\)/);
});
