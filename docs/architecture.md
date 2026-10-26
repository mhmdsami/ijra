# Architecture

ijra has two parts. The dashboard lives in this repo and runs on Cloudflare Workers. The runner lives in a private repo and runs on GitHub Actions.

## Components

- **Dashboard**: Next.js app with better-auth, D1, and an admin UI. It creates sessions, dispatches runs, streams progress, and records decisions.
- **Runner**: a GitHub Actions workflow plus `run-request.mjs`. It clones the target repo, runs the agent, checks the diff, and returns an answer or a pull request.
- **Control plane**: sessions, grants, quotas, policies, and the audit log. It lives in the dashboard and its D1 database.
- **Target repos**: the repositories the agent works in. Each must contain an `AGENTS.md`; the runner injects it as project context.

## Run lifecycle

1. The dashboard creates a session and dispatches the runner workflow with the project, request, session id, mode, and run id.
2. The runner clones the repo and runs pi on a model from opencode-go. The pi session id and directory round-trip through Actions artifacts, so one ijra session keeps one agent memory.
3. The agent decides whether the request is a question or a change. Questions return in chat. Changes are implemented and checked against policy: paths outside `safePaths`, protected paths such as CI, dependencies, or auth, more than 12 files, or more than 400 changed lines all fail the run.
4. Clean changes are type-checked and built per the registry, committed through the Git data API with a verified signature, and opened as a pull request. There is no auto-merge; an admin reviews it in the session and either merges (after the dashboard revalidates the pull, its checks, and the file and line limits) or rejects it with a reason.
5. The runner reports back over an HMAC-signed webhook. The dashboard also polls the Actions API as a fallback, and a GitHub webhook updates the run when the pull request is merged, closed, or reopened.

## Ownership

Sessions are owned. Only the owner with a project grant, or an admin, can read a session. Admins see every project. Write access allows changes; read-only access allows questions only.

## Limits and audit

`createRun` enforces 5 requests per user per day and 1 active run per project atomically. Every request, report, cancel, delete, review action, and retry writes to an `audit_events` table with triggers that reject updates and deletes.

## Auth

Sign-in is Google only through better-auth. On an empty database the first person to sign in becomes the admin. Local preview bypasses auth only when `LOCAL_PREVIEW=1` and `BETTER_AUTH_URL` points at localhost.
