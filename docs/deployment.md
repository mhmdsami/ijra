# Deployment

The dashboard deploys to Cloudflare Workers. The runner deploys to GitHub Actions.

## Dashboard

Create the D1 database, then fill its binding into `wrangler.jsonc`:

```sh
npx wrangler d1 create ijra
```

Set Worker secrets:

```sh
npx wrangler secret put GITHUB_PAT
npx wrangler secret put IJRA_RUNNER_KEY
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

The PAT needs workflow dispatch and Actions read on the runner repo.

Set repository secrets and variables:

- `PROJECTS_JSON`: the contents of `src/projects.json`, pointing `runnerRepo` at the runner repo.
- `NEXT_PUBLIC_SITE_URL`: the public origin, used for metadata and OG images.
- `CLOUDFLARE_API_TOKEN`: repository secret.
- `CLOUDFLARE_ACCOUNT_ID`: repository variable.

Google OAuth redirect URI: `https://<your-domain>/api/auth/callback/google`.

## Runner

Set these secrets on the runner repo:

- `APP_ID`, `APP_PRIVATE_KEY`: the GitHub App.
- `OPENCODE_API_KEY`: an opencode-go key.
- `IJRA_RUNNER_KEY`: the same value as the dashboard.

## CI

Pushes to `main` deploy through `.github/workflows/deploy.yml`:

1. `npm ci`
2. `npm audit --audit-level=low --omit=dev`
3. `npm run types`
4. `npm test`
5. D1 migrations (`wrangler d1 migrations apply ijra --remote`)
6. `npm run deploy`

## Manual deploy

```sh
npm run deploy
```

Use this only when CI cannot run. Migrations are applied by the workflow before the Worker deploy.
