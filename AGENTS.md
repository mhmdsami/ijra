# AGENTS.md

You are working in ijra, a service that runs small fixes and answers questions about Sami's other repos as agent-driven pull requests or chat answers. The dashboard lives here (`src/`, Next.js on Cloudflare Workers). The actual runner lives in a separate private repo — run history and secrets must never land here, so this repo can stay public. `runner/` here is a copy of the runner code kept in sync by hand; treat the private repo as the deployed source of truth.

## What to know before editing

- The runner is generic. `runner/run-request.mjs` must never mention a specific project, model, or product name; project specifics live in the runner repo's `registry.json` and each target repo's own `AGENTS.md`, which the runner requires and injects into the prompt. The dashboard's own project list is `src/projects.json` (id, repo, default model only). Sami has renamed this app three times; keep identifiers generic so the next rename is cheap. If you change the runner, copy it to both repos.
- The dashboard talks to GitHub with a PAT (`src/lib/runner/gh-actions.ts`) and dispatches the same workflow the CLI would. Keep the two paths consistent: branch patterns in `findPr` must match what the runner creates (`ft-`/`fx-`/`ch-`/`rf-` prefixes, session id in the middle).
- GitHub's API rejects requests without a User-Agent header. Every `fetch` to api.github.com sets one; don't remove it.
- GitHub's dispatch API rejects inputs the workflow doesn't declare (422). `startRun` and `dispatch.yml` inputs must stay in sync.
- The runner reports results to the dashboard over an HMAC-signed webhook (`/api/internal/answer`, signed with `IJRA_RUNNER_KEY` over `timestamp.body`). The dashboard also polls the Actions API as a fallback. The runner sends the agent's reply text in `summary`; the webhook route persists it as the agent chat message and sets `agent_msg` so the poller doesn't duplicate it.
- Two modes: `fix` opens a PR, `ask` answers read-only (changes are discarded, no PR). The pi session id and dir round-trip through Actions artifacts so one ijra session shares one agent memory. `--session-id`/`--session-dir` must stay in sync with the workflow's artifact upload/download.
- The runner enforces policy before creating a PR: changes outside `safePaths`, protected paths (CI, deps, auth), more than 12 files, or more than 400 changed lines fail the run. There is no auto-merge — every PR lands as `awaiting_review`.
- PR bodies are written by the agent. The runner parses everything after the `Title:` line as the description and appends a metadata table, so the agent's reply format is load-bearing. If you change the prompt rules in `buildPrompt`, check the parsing in the commit/PR section still holds.
- Variables in the runner have died twice by being used above their declaration (`ErrandError`, then `title`). Declare before use, and run `node --check runner/run-request.mjs` after editing it.
- Commits from the runner go through the git data API, not `git push`, because GitHub signs API-created commits. Plain pushes are not signed.
- Next.js build rewrites `tsconfig.json` and `next-env.d.ts`. The runner restores them before computing the safe zone, so don't "fix" that by editing the target repos' tsconfig.
- Rate limits and audit live in the control plane: `createRun` enforces 5 requests per user per day and 1 active run per project atomically; every request/report/cancel/delete writes to the append-only `audit_events` table (DB triggers reject updates and deletes). Don't bypass them.
- Sessions are owned: `canAccessSession` allows the owner (with a project grant) or an admin. `listSessionsForUser` must stay in sync with that rule.

## Working here

- Conventional Commits, imperative subject, 50 chars or fewer. Branch prefixes: `ft-`, `fx-`, `ch-`, `rf-`.
- No new dependencies without asking. The dashboard runs on Workers, so anything Node-only won't survive; check workerd compatibility.
- Verify with `npx tsc --noEmit` before pushing, and `node --check runner/run-request.mjs` after touching the runner.
- Deploys run automatically via `.github/workflows/deploy.yml` on every push to main (typecheck, D1 migrations, `opennextjs-cloudflare deploy`). Don't deploy manually unless the Action can't; migrations apply as part of the deploy.
- Auth is better-auth with the admin plugin. Admins see all projects; everyone else sees only what's granted in `user_projects` and their own sessions. The first sign-in on an empty database becomes admin, so never point strangers at a fresh deployment before Sami has signed in.
- Never log or commit secrets. The Google OAuth client secret, PAT, Cloudflare API token, and signing keys live in Worker/repo secrets.
