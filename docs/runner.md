# Runner

The runner is a private GitHub repo: one Actions workflow and `run-request.mjs`. The `runner/` folder in this repo is a hand-synced copy for self-hosting.

## Setup

1. Copy the `runner/` folder into a private repo.
2. Rename `registry.example.json` to `registry.json`, and `.github/workflows/dispatch.example.yml` to `.github/workflows/dispatch.yml`.
3. Fill `registry.json` with target repos, install and verify commands, `safePaths`, and allowed models.
4. Create a GitHub App with Contents and Pull requests read/write access, installed on the target repos.
5. Set repository secrets: `APP_ID`, `APP_PRIVATE_KEY`, `OPENCODE_API_KEY`, and `IJRA_RUNNER_KEY`.
6. Every target repo must have an `AGENTS.md`. The runner refuses to run without one and injects it into the prompt.

## Dispatch

The dashboard dispatches the workflow with the project, request, session id, mode, and run id. `dispatch.yml` inputs and `startRun` in `src/lib/runner/gh-actions.ts` must stay in sync; GitHub rejects undeclared inputs.

## Prompt and agent

The runner builds the prompt from the request and the target repo's `AGENTS.md`, then runs pi on a model from opencode-go. The pi session id and directory are stored as Actions artifacts, so one ijra session shares one agent memory across runs.

## Policy

Before a PR is created, the runner checks:

- every changed file is inside the project's `safePaths`
- protected paths such as CI, dependencies, and auth are untouched
- no more than 12 files changed
- no more than 400 changed lines

A failed check marks the run blocked. There is no auto-merge.

## Verification and PRs

Clean changes run the project's type-check and build commands from the registry. Commits go through the Git data API, which produces GitHub-signed commits, then the PR is opened and waits for review. The dashboard records the PR URL and branch on the run.

## Reporting

The runner reports over an HMAC-signed webhook to `/api/internal/answer`. The dashboard also polls the Actions API. The webhook stores the agent reply as the chat message and sets `agent_msg`, so the poller does not duplicate it.

## Checks

Run `node --check runner/run-request.mjs` after editing the runner. Keep the copy in this repo in sync with the private repo.
