# ijra

File it, the agent fixes it, the PR waits for your review.

*ijra* (إجراء) is Arabic for procedure, the act of carrying something out. You file a request, ijra carries it out.

Anyone with access can ask a question about a repo or file a fix. A pi coding agent works in the repo and either answers in chat or opens a verified pull request. Write access lets the agent decide which; read-only access gets answers.

## Quick start

```sh
npm install
npm run db:local
npm run dev
```

Set `LOCAL_PREVIEW=1` in `.dev.vars` to use the dashboard without Google sign-in.

```sh
npm run gate   # types, tests, build, smoke
```

## Layout

- `src/` - the dashboard, a Next.js app on Cloudflare Workers.
- `runner/` - a copy of the private runner repo for self-hosting.
- `src/projects.json` - your project list. Gitignored; see `src/projects.example.json`.
- `migrations/d1/` - D1 schema.
- `docs/` - architecture, runner, administration, development, deployment.

## Docs

- [Architecture](docs/architecture.md) - components, runs, ownership, quotas.
- [Runner](docs/runner.md) - dispatch, policy, PR flow, webhook.
- [Administration](docs/administration.md) - grants, models, audit, projects.
- [Development](docs/development.md) - local setup, scripts, tests.
- [Deployment](docs/deployment.md) - Cloudflare resources, secrets, CI.
