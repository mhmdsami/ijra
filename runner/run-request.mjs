#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHmac, createSign } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

class RunError extends Error {}
function die(msg) {
  throw new RunError(msg);
}

function sh(...args) {
  const opts = typeof args.at(-1) === "object" ? args.pop() : {};
  const [cmd, label = cmd] = args;
  console.log(`\n$ ${label}`);
  const r = spawnSync(cmd, { shell: true, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", env: opts.env ?? process.env });
  if (r.stdout?.trim()) console.log(r.stdout.trim().slice(0, 2000));
  if (r.stderr?.trim()) console.error(r.stderr.trim().slice(0, 2000));
  if (r.status !== 0 && !opts.allowFail) die(`${label} failed (exit ${r.status})`);
  return r;
}

function shq(s) {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function firstLine(s) {
  return s.trim().split("\n")[0];
}

function slug(s) {
  return firstLine(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "request";
}

function glob(pattern) {
  const esc = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\0")
    .replace(/\*/g, "[^/]*")
    .replace(/\0/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${esc}$`);
}

async function mintInstallationToken() {
  const b64url = (buf) => Buffer.from(buf).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const claim = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(
    JSON.stringify({ iat: now - 60, exp: now + 600, iss: APP_ID })
  )}`;
  const signer = createSign("RSA-SHA256");
  signer.update(claim);
  const jwt = `${claim}.${signer.sign(APP_PRIVATE_KEY.replace(/\\n/g, "\n"), "base64url")}`;

  const api = async (path, auth, init) => {
    const res = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${auth}`, Accept: "application/vnd.github+json", "User-Agent": "ijra-runner", ...(init?.headers ?? {}) },
    });
    if (!res.ok) die(`App API ${path} failed (${res.status}): ${await res.text()}`);
    return res.json();
  };

  const installation = await api(`/repos/${cfg.repo}/installation`, jwt);
  if (!installation?.id) die(`App is not installed for ${cfg.repo}`);
  const token = await api(`/app/installations/${installation.id}/access_tokens`, jwt, {
    method: "POST",
    body: JSON.stringify({ repositories: [cfg.repo.split("/")[1]], permissions: { contents: "write", pull_requests: "write" } }),
  });
  const app = await api("/app", jwt);
  const botLogin = `${app.slug}[bot]`;
  return { token: token.token, botId: app.id, botLogin };
}

function rmrf(p) {
  spawnSync("rm", ["-rf", p]);
}

function buildPrompt(cfg, request, mode) {
  const agents = ["AGENTS.md", "CLAUDE.md"].find(existsSync);
  if (!agents) die(`No AGENTS.md or CLAUDE.md in ${cfg.repo}. Target repos must carry their own conventions`);

  const ask = mode === "ask";
  const rules = ask
    ? `
## Rules
- Answer the question using read-only exploration of this repository.
- Do NOT modify, create, or delete files. If the user asks for a change, describe exactly what you would change instead of doing it.
- Do NOT run any git write commands.
- Reply directly in markdown, concise. This reply is delivered as chat.`
    : `
## Rules
- Decide whether the request is a question or a change request.
- If it is a question: answer it using read-only exploration, change nothing, and reply in markdown as chat.
- If it is a change request: make minimal, focused changes that satisfy it. Match existing code style.
- Do NOT run any git write commands (add, commit, push, checkout), the harness handles version control.
- Do NOT create, modify, or delete CI workflows (.github/), and never touch secrets or environment files.
- Do NOT install new dependencies or edit lockfiles unless the request explicitly requires it.
- You may run read-only commands to understand the code and check your work.
- If the request is ambiguous, state your interpretation and any assumptions at the top of your reply.
- When you made changes, end your reply with the PR metadata in this exact format:
  Title: <type>: <imperative summary, max 50 chars; type is one of feat, fix, chore, refactor, docs; e.g. "fix: limit fleet grid to three columns">
  ## PR description
  <markdown describing what changed, why, and how it was verified — this becomes the PR body>
- When you changed nothing, reply plainly; this reply is delivered as chat.`;
  return [
    ask
      ? "You are answering a question about this repository."
      : "You are working on this repository. Decide whether the request below is a question to answer or a change to make.",
    "",
    "## Request",
    "",
    request,
    `\n## Repository conventions (${agents})\n\n${readFileSync(agents, "utf8")}`,
    rules,
  ].join("\n");
}

async function finish(code) {
  await report(outcome.status, outcome.agentSummary.slice(0, 4000));
  writeFileSync(resolve(artifacts, "outcome.json"), JSON.stringify(outcome, null, 2));
  if (GITHUB_OUTPUT) {
    writeFileSync(
      GITHUB_OUTPUT,
      [
        `status=${outcome.status}`,
        `pr_url=${outcome.prUrl ?? ""}`,
        `branch=${outcome.branch ?? ""}`,
        `safe_zone=${outcome.safeZone ?? ""}`,
      ].join("\n") + "\n",
      { flag: "a" }
    );
  }
  if (GITHUB_STEP_SUMMARY) {
    writeFileSync(
      GITHUB_STEP_SUMMARY,
      [
        `## Request \`${outcome.project}/${outcome.session}\``,
        "",
        `**Status:** \`${outcome.status}\``,
        outcome.prUrl ? `**PR:** ${outcome.prUrl}` : "",
        `**Model:** \`${outcome.model}\``,
        `**Safe zone:** ${outcome.safeZone ?? "n/a"}`,
        "",
        "<details><summary>Changed files</summary>",
        "",
        ...outcome.changedFiles.map((f) => `- \`${f}\``),
        "",
        "</details>",
      ]
        .filter(Boolean)
        .join("\n") + "\n"
    );
  }
  process.exit(code);
}

const {
  PROJECT,
  REQUEST,
  SESSION = "",
  MODEL = "",
  MODE = "fix",
  RUN_ID = "",
  APP_ID,
  APP_PRIVATE_KEY,
  GITHUB_OUTPUT = "",
  GITHUB_STEP_SUMMARY = "",
  IJRA_WEBHOOK_URL = "",
  IJRA_RUNNER_KEY = "",
} = process.env;

if (!REQUEST?.trim()) die("REQUEST is empty");
if (!APP_ID || !APP_PRIVATE_KEY) die("APP_ID / APP_PRIVATE_KEY secrets are not set");

const here = new URL(".", import.meta.url).pathname;
const registry = JSON.parse(readFileSync(resolve(here, "registry.json"), "utf8"));
const cfg = registry[PROJECT];
if (!cfg) die(`Unknown project "${PROJECT}". Known: ${Object.keys(registry).join(", ")}`);
if (cfg.enabled === false) die(`Project "${PROJECT}" is not enabled yet`);

const session = SESSION || `ts${Date.now().toString(36)}`;
const model = MODEL || cfg.defaultModel;
if (MODE !== "fix" && MODE !== "ask" && MODE !== "auto") die(`Unknown mode "${MODE}"`);
const artifacts = resolve(here, "../artifacts");
mkdirSync(artifacts, { recursive: true });

async function report(status, summary) {
  if (!IJRA_WEBHOOK_URL || !IJRA_RUNNER_KEY) return;
  const body = JSON.stringify({ session, runId: RUN_ID || null, status, summary, outcome });
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", IJRA_RUNNER_KEY).update(`${timestamp}.${body}`).digest("hex");
  try {
    await fetch(IJRA_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ijra-timestamp": timestamp, "x-ijra-signature": signature },
      body,
      signal: AbortSignal.timeout(5000),
    });
  } catch {
  }
}

const outcome = {
  status: "failed",
  project: PROJECT,
  repo: cfg.repo,
  session,
  model,
  branch: null,
  prUrl: null,
  changedFiles: [],
  safeZone: null,
  policyReasons: [],
  changedLines: 0,
  agentSummary: "",
  verify: {},
};

try {
  const work = resolve(artifacts, "work");
  rmrf(work);
  const { token: GH_TOKEN, botId, botLogin } = await mintInstallationToken();
  const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !["APP_ID", "APP_PRIVATE_KEY", "IJRA_RUNNER_KEY", "GH_TOKEN", "OPENCODE_API_KEY"].includes(key)));
  const piEnv = { ...cleanEnv, OPENCODE_API_KEY: process.env.OPENCODE_API_KEY };
  sh(`git clone --depth 50 https://x-access-token:${GH_TOKEN}@github.com/${cfg.repo}.git ${work}`, "clone", { env: cleanEnv });
  process.chdir(work);
  sh(cfg.install.join(" "), "install", { env: cleanEnv });

  const prompt = buildPrompt(cfg, REQUEST, MODE);
  const requestPath = resolve(artifacts, "request.md");
  writeFileSync(requestPath, prompt);
  const skillArgs = existsSync(resolve(here, "skills"))
    ? readdirSync(resolve(here, "skills"), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => `--skill ${shq(resolve(here, "skills", d.name))}`)
        .join(" ")
    : "";
  const sessionDir = resolve(here, "../pi-session");
  if (SESSION) mkdirSync(sessionDir, { recursive: true });
  const sessionArgs = SESSION ? `--session-id ${shq(SESSION)} --session-dir ${shq(sessionDir)}` : "";
  const pi = sh(
    `pi -p --provider opencode-go --model ${model} ${skillArgs} ${sessionArgs} < ${shq(requestPath)} > ../pi-response.txt`,
    "pi",
    { allowFail: true, env: piEnv }
  );
  if (pi.status !== 0) die(`pi exited ${pi.status}. See artifacts/pi-response.txt`);
  const agentSummary = readFileSync(resolve(work, "../pi-response.txt"), "utf8").trim().slice(0, 4000);
  outcome.agentSummary = agentSummary;

  if (MODE === "ask") {
    sh("git checkout -- . && git clean -fd", "discard changes", { allowFail: true, env: cleanEnv });
    outcome.status = "answered";
    await finish(0);
  }

  let changes = sh("git status --porcelain", "status").stdout
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => ({ path: l.slice(3).trim().replace(/^"|"$/g, ""), deleted: l.slice(0, 2).includes("D") }));
  let changed = changes.map((c) => c.path);
  if (changed.length === 0) {
    outcome.status = MODE === "auto" ? "answered" : "no_changes";
    await finish(0);
  }
  outcome.changedFiles = changed;
  outcome.agentSummary = agentSummary;
  const protectedPath = /(^|\/)(package(-lock)?\.json|bun\.lockb?|pnpm-lock\.yaml|yarn\.lock|\.github\/|migrations?\/|src\/lib\/|src\/app\/api\/|auth)/i;
  const disallowed = changed.filter((file) => protectedPath.test(file) || !(cfg.safePaths ?? []).some((pattern) => glob(pattern).test(file)));
  const lineStats = sh("git diff --numstat", "line-stats", { env: cleanEnv }).stdout.trim().split("\n").filter(Boolean);
  outcome.changedLines = lineStats.reduce((total, line) => { const [added, deleted] = line.split("\t"); return total + (Number(added) || 0) + (Number(deleted) || 0); }, 0);
  if (changed.length > 12) outcome.policyReasons.push(`changed ${changed.length} files; limit is 12`);
  if (outcome.changedLines > 400) outcome.policyReasons.push(`changed ${outcome.changedLines} lines; limit is 400`);
  if (disallowed.length) outcome.policyReasons.push(`review required: ${disallowed.join(", ")}`);
  if (outcome.policyReasons.length) die(`Policy blocked PR creation: ${outcome.policyReasons.join("; ")}`);

  for (const step of cfg.verify ?? []) {
    const r = sh(step.cmd.join(" "), `verify:${step.name}`, { allowFail: true, env: cleanEnv });
    outcome.verify[step.name] = r.status === 0 ? "pass" : "fail";
    if (r.status !== 0) {
      writeFileSync(resolve(artifacts, `${step.name}.log`), r.stdout + r.stderr);
      die(`Verification "${step.name}" failed. Log: artifacts/${step.name}.log`);
    }
  }

  outcome.safeZone = changed.every((f) => (cfg.safePaths ?? []).some((g) => glob(g).test(f)));

  const generated = ["tsconfig.json", "next-env.d.ts", "tsconfig.tsbuildinfo"];
  const drifted = changed.filter((f) => generated.includes(f));
  if (drifted.length) {
    sh(`git checkout -- ${drifted.join(" ")}`, { allowFail: true });
    changed = changed.filter((f) => !drifted.includes(f));
    outcome.changedFiles = changed;
    outcome.safeZone = changed.every((f) => (cfg.safePaths ?? []).some((g) => glob(g).test(f)));
  } else {
    outcome.safeZone = changed.every((f) => (cfg.safePaths ?? []).some((g) => glob(g).test(f)));
  }

  const titleMatch = agentSummary.match(/^Title:\s*(.+)$/m);
  const rawTitle = titleMatch?.[1].trim() || `chore: ${firstLine(REQUEST)}`;
  const conv = rawTitle.match(/^(\w+):\s*(.+)$/);
  const TYPE_BRANCH = { feat: "ft", fix: "fx", chore: "ch", refactor: "rf", docs: "ch" };
  const type = conv && TYPE_BRANCH[conv[1].toLowerCase()] ? conv[1].toLowerCase() : "chore";
  const subject = (conv ? conv[2] : rawTitle).trim().replace(/[.!]+$/, "").slice(0, 50);
  const title = `${type}: ${subject}`;
  const branch = `${TYPE_BRANCH[type]}-${session}-${slug(REQUEST)}`;
  outcome.branch = branch;
  const description = titleMatch
    ? agentSummary
        .slice(agentSummary.indexOf(titleMatch[0]) + titleMatch[0].length)
        .replace(/^\s*## PR description\s*/, "")
        .trim() || agentSummary
    : agentSummary;

  const api = async (path, init) => {
    const res = await fetch(`https://api.github.com/repos/${cfg.repo}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "ijra-runner", ...(init?.headers ?? {}) },
    });
    if (!res.ok) die(`${init?.method ?? "GET"} ${path} failed (${res.status}): ${await res.text()}`);
    return res.json();
  };
  const headSha = sh("git rev-parse HEAD").stdout.trim();
  const baseTree = sh("git rev-parse HEAD^{tree}").stdout.trim();
  const treeEntries = [];
  for (const c of changes) {
    if (c.deleted) {
      treeEntries.push({ path: c.path, sha: null, mode: "100644", type: "blob" });
      continue;
    }
    const blob = await api("/git/blobs", {
      method: "POST",
      body: JSON.stringify({ content: readFileSync(resolve(work, c.path)).toString("base64"), encoding: "base64" }),
    });
    treeEntries.push({ path: c.path, sha: blob.sha, mode: "100644", type: "blob" });
  }
  const tree = await api("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: baseTree, tree: treeEntries }) });
  const commit = await api("/git/commits", {
    method: "POST",
    body: JSON.stringify({
      message: `${title}\n\nSession: ${session}\nModel: ${model}\nRequested by: runner`,
      tree: tree.sha,
      parents: [headSha],
      author: { name: botLogin, email: `${botId}+${botLogin}@users.noreply.github.com` },
    }),
  });
  await api("/git/refs", { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }) });

  const body = [
    description,
    "",
    `| | |`,
    `|---|---|`,
    `| Session | \`${session}\` |`,
    `| Model | \`${model}\` |`,
    `| Files | ${changed.length} |`,
    `| Verify | ${Object.entries(outcome.verify).map(([k, v]) => `${k}: ${v}`).join(", ") || "n/a"} |`,
    `| Safe zone | ${outcome.safeZone ? "yes" : "**no — needs review**"} |`,
    "",
    `Automated by ijra.`,
  ].join("\n");
  writeFileSync("../pr-body.md", body);
  sh(`gh pr create --repo ${cfg.repo} --head ${branch} --title ${shq(title)} --body-file ../pr-body.md`, "pr", { env: { ...cleanEnv, GH_TOKEN } });
  const prUrl = sh(`gh pr view ${shq(branch)} --repo ${cfg.repo} --json url -q .url`, "pr-url", { env: { ...cleanEnv, GH_TOKEN } }).stdout.trim();
  outcome.prUrl = prUrl;

  outcome.status = "awaiting_review";
  await finish(0);
} catch (e) {
  if (e instanceof RunError) {
    console.error(`\nrunner: ${e.message}`);
    await finish(1);
  }
  throw e;
}
