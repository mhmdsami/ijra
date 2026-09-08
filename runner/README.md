# runner

Copy this folder into your **private** runs repo (see the ijra README for setup). Files named `*.example.*` are templates — rename them when you copy:

- `run-request.mjs` — the agent run script
- `registry.example.json` → `registry.json` — project specifics (repos, install/verify, `safePaths`, models)
- `.github/workflows/dispatch.example.yml` → `.github/workflows/dispatch.yml` — the workflow the dashboard dispatches
- `skills/` — skills injected into the agent
