# ijra

File it, the agent fixes it, the PR waits for your review.

The name: *ijra* (إجراء), Arabic for "procedure", the act of carrying something out. You file a request, ijra carries it out.

Anyone you grant access can ask a question about a repo or file a fix ("the footer year is wrong"). A pi coding agent works in the repo and either answers in chat or opens a verified pull request. Write access lets the agent decide which; read-only access gets questions only.

## Two repos

The dashboard lives here (`src/`, Next.js on Cloudflare Workers). You chat with the agent, watch runs, and manage who can touch which repo. The project list is `src/projects.json`, which is gitignored because it names your private repos. `src/projects.example.json` shows the shape.

The runner lives in a second, private repo: a GitHub Actions workflow plus a script that clones the target repo, runs the agent, and ships the PR or the answer. Run history, logs, and agent-session artifacts stay there, so this repo can stay public. The `runner/` folder here is a copy of that code for self-hosting.

## How a run works

1. The dashboard dispatches the workflow with the project, request, session id, mode, and run id.
2. `run-request.mjs` clones the repo, builds a prompt from the request plus the target repo's own `AGENTS.md`, and runs [pi](https://github.com/earendil-works) on a model from opencode-go. The pi session id and dir round-trip through Actions artifacts, so one ijra session shares one agent memory.
3. The agent decides what the request is. A question gets answered in chat. A change request gets implemented, and then the runner checks policy: files outside `safePaths`, protected paths (CI, deps, auth), more than 12 files, or more than 400 changed lines all fail the run. Clean changes are type-checked and built per the registry, committed through the git data API (verified signature), and opened as a PR that waits for review. No auto-merge.
4. The runner reports back over an HMAC-signed webhook. The dashboard also polls the Actions API as a fallback.

## Self-hosting

1. Create a private repo for runs. Copy this repo's `runner/` into it and rename the templates: `dispatch.example.yml` becomes `.github/workflows/dispatch.yml`, `registry.example.json` becomes `registry.json`. Fill the registry with your projects: target repo, install and verify commands, `safePaths`, allowed models.
2. Create a GitHub App with Contents and Pull requests read/write, installed on the repos the agent should work in. Set repo secrets on the runner repo: `APP_ID`, `APP_PRIVATE_KEY`, `OPENCODE_API_KEY` (an [opencode-go](https://opencode.ai) key), and `IJRA_RUNNER_KEY` (any random string, shared with the dashboard).
3. Target repos must carry an `AGENTS.md`. The runner refuses to run without one and injects it as project context.
4. Deploy the dashboard. Worker secrets: `GITHUB_PAT` (needs workflow dispatch and Actions read on the runner repo), `IJRA_RUNNER_KEY` (same value as the runner repo), `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Repo secrets: `PROJECTS_JSON` holds the contents of `src/projects.json`, pointing `runnerRepo` at your runner repo and listing your projects. Set the `NEXT_PUBLIC_SITE_URL` variable so the OG metadata points at your deployment.
5. Pushes to main deploy automatically via `.github/workflows/deploy.yml`: typecheck, D1 migrations, `opennextjs-cloudflare deploy`. Set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repo secret and variable.

## Control plane

Sessions are owned: only the session owner (with a project grant) or an admin can see one. `createRun` enforces 5 requests per user per day and 1 active run per project, atomically. Every request, report, cancel, and delete lands in an append-only `audit_events` table; triggers reject updates and deletes.

## Local development

```bash
npm install
npm run db:local      # apply D1 migrations locally
npx opennextjs-cloudflare build
npx opennextjs-cloudflare preview --port 8787
```

Put `BETTER_AUTH_URL=http://localhost:8787` and a local `BETTER_AUTH_SECRET` in `.dev.vars` (gitignored). The preview skips auth and runs as a synthetic admin. Auth is Google-only through better-auth; on a fresh database the first person to sign in becomes the admin.
