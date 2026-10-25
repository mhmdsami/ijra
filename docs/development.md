# Development

## Requirements

- Node.js `>=24.22.1`
- npm

## Setup

```sh
npm install
npm run db:local
npm run dev
```

Create `.dev.vars` with local values:

```sh
GITHUB_PAT=local-dev-placeholder
LOCAL_PREVIEW=1
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=local-dev-secret
IJRA_RUNNER_KEY=local-dev-runner-key
IJRA_SESSION_SECRET=local-dev-session-secret
GOOGLE_CLIENT_ID=local-dev-client-id
GOOGLE_CLIENT_SECRET=local-dev-client-secret
```

`LOCAL_PREVIEW=1` signs you in as a local admin. It is honored only when `BETTER_AUTH_URL` starts with `http://localhost`.

For the full Worker path:

```sh
npm run preview
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | `next dev` |
| `npm run build` | `next build` |
| `npm run preview` | build the OpenNext Worker and preview it |
| `npm run deploy` | build and deploy to Cloudflare |
| `npm run db:local` | apply D1 migrations locally |
| `npm run db:remote` | apply D1 migrations remotely |
| `npm run types` | `tsc --noEmit` |
| `npm test` | node test runner |
| `npm run smoke` | start a dev server on port 3123 and check `/` and `/login` |
| `npm run gate` | types, tests, build, smoke |

The smoke test needs `.dev.vars` and a migrated local D1 database.

## Checks

`npm run gate` is the full check. The pre-commit hook runs it. Run `node --check runner/run-request.mjs` after editing the runner.

Next.js 16 is configured with `agentRules: false`, so `next dev` does not write a managed block into `AGENTS.md`.
