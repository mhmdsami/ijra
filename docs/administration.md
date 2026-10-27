# Administration

The admin area is at `/admin`. It manages access, daily quotas, models, and the audit log.

## Access

Admins see every project. Everyone else gets per-project grants:

- **ask**: questions only.
- **write**: questions and pull requests.

Grants are stored in `user_projects`. The project list comes from `src/projects.json`; see `src/projects.example.json` for the shape. That file is gitignored because it names private repos.

## Quotas

Each user has a daily request limit, default 5. A project can have one active run at a time. `createRun` enforces both atomically. Failed, blocked, and cancelled runs do not consume the daily limit, and the window resets at midnight UTC.

Images have separate storage caps: 3 per message, 1.5 MB each, 20 per session, and 40 per user per UTC day. The upload insert enforces the session and daily caps in one statement, and deleting a thread deletes its images.

## Models

`/admin/models` lists models from the opencode-go catalog at models.dev. Enable the models that should appear in the composer, pick a default, and remove ones you no longer use. The catalog is cached in memory for 5 minutes; a failed refresh does not authorize a model that could not be verified.

## Review

A change run ends at `awaiting_review` with its pull request. Admins can act from the session:

- **Merge** re-reads the pull request, its changed files, and its check runs, re-applies the 12-file and 400-line limits, then squash-merges. Failing or pending checks block the merge.
- **Reject** requires a reason, marks the run rejected, and leaves the pull request open.
- **Retry** re-dispatches a failed, cancelled, rejected, blocked, or closed run as a new run linked to its source.

Every action writes an audit event. There is still no automatic merge.

## Audit

`/admin/audit` lists the most recent runs and audit events, filterable by project and requester. Every request, report, cancel, delete, review action, grant change, and model change writes to `audit_events`. Updates are rejected by a trigger, so retained events stay immutable. A daily scheduled job calls the signed `/api/internal/purge-audit` endpoint to delete events older than 12 months; there is no export.

## First admin

On an empty database, the first person to sign in becomes the admin. Do not expose a fresh deployment to strangers before that first sign-in.
