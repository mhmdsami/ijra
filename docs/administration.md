# Administration

The admin area is at `/admin`. It manages access, daily quotas, models, and the audit log.

## Access

Admins see every project. Everyone else gets per-project grants:

- **ask**: questions only.
- **write**: questions and pull requests.

Grants are stored in `user_projects`. The project list comes from `src/projects.json`; see `src/projects.example.json` for the shape. That file is gitignored because it names private repos.

## Quotas

Each user has a daily request limit, default 5. A project can have one active run at a time. `createRun` enforces both atomically.

## Models

`/admin/models` lists models from the opencode-go catalog at models.dev. Enable the models that should appear in the composer, pick a default, and remove ones you no longer use. The catalog is cached in memory for 5 minutes; a failed refresh does not authorize a model that could not be verified.

## Audit

Every request, report, cancel, delete, grant change, and model change writes to `audit_events`. Database triggers reject updates and deletes, so the log is append-only.

## First admin

On an empty database, the first person to sign in becomes the admin. Do not expose a fresh deployment to strangers before that first sign-in.
