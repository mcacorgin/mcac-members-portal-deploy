# MCAC Members Portal

Private members portal for MCAC: vetted registration with recorded privacy consent, admin approval, a member directory with per-field contact permissions, and shared opportunities, jobs, knowledge, and events.

Contracts live in `../docs/build/` (permission matrix, state machines, route map, events, attachments) and `../.planning/BUILD-PLAN.md`. The approved visual system is ported from `../design/wireframes/`.

## Development

Requirements: Node 20+, pnpm, local PostgreSQL.

```bash
pnpm install
cp .env.example .env.local        # fill DATABASE_URL and AUTH_SECRET
createdb mcac_portal              # or point DATABASE_URL elsewhere
pnpm db:migrate                   # apply the versioned schema and security migrations
pnpm db:seed                      # fixtures: 206 users, sample posts
pnpm dev
```

`pnpm db:migrate` is the reproducible database setup path in local and hosted
environments. The ordered migrations under `drizzle/` install `pg_trgm`,
create the application schema, and apply the fail-closed Supabase security
boundary. Production setup must stop before `pnpm db:seed`; seed data is for
local development only.

Future schema changes must be generated and reviewed as ordered Drizzle
migrations. Do not use `pnpm db:push` for production because it bypasses the
reviewed migration history.

Readiness check:

```sql
SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';
```

### Fixture accounts (password: `mcac-dev-password`)

| Email | Role / state |
|---|---|
| admin@example.com | administrator, approved |
| member@example.com | member, approved |
| pending@example.com | applicant, pending |
| needschanges@example.com | applicant, needs changes |
| rejected@example.com | applicant, rejected |
| suspended@example.com | member, suspended |

### Scripts

- `pnpm typecheck` / `pnpm lint` - static checks
- `pnpm test:e2e` - Playwright (desktop + 390px mobile projects)
- `pnpm db:migrate` - apply the reviewed schema and security history
- `pnpm db:push` / `pnpm db:seed` - local development only
- `pnpm db:bootstrap` - idempotent production privacy and expertise reference data; never creates users or deletes data
- `GET /api/jobs/run` - Vercel Cron sweep, authorized by `CRON_SECRET`
- `POST /api/jobs/run` - external scheduler or administrator sweep, authorized by `JOBS_SECRET` or an admin session
- `pnpm package:godaddy` - create a secret-free, sub-100 MB GoDaddy Node.js Hosting upload under `.deploy/`
- `GET /api/jobs/retention` - daily attachment-retention sweep, authorized by `CRON_SECRET`
- `POST /api/jobs/retention` - external daily retention sweep, authorized by `JOBS_SECRET`
- `GET /api/health` - uncached database, production configuration, and reference-data readiness check

## Configuration

Pending client decisions are runtime config (Admin -> Policy, `app_config` table), never code: gold presence, email fallback, per-field contact defaults, opportunity expiry days, section toggles. See `src/lib/config.ts`.

Environment: see `.env.example`. LinkedIn sign-in appears only when `AUTH_LINKEDIN_ID/SECRET` are set. Email uses the console in dev and Resend when `RESEND_API_KEY` is set. Attachments use local disk in dev and a private Supabase bucket when `STORAGE_DRIVER=supabase`.

Attachment retention defaults to `ATTACHMENT_RETENTION_MODE=dry-run`. The
daily retention endpoint reports files older than 60 days without deleting
them. Set the Production value to `delete` only after MCAC approves the final
privacy and retention notice. Deletion removes the private object but keeps
the attachment metadata and an audit record; administrators can exempt a post.

### Release interface and rollback

The polished interface is the default. The approved interface stays available
as a presentation-only rollback. The selection does not change routes, form
names, server actions, queries, authorization, or database behavior.

```bash
# Release default
MCAC_UI_VARIANT=polished

# Presentation rollback
MCAC_UI_VARIANT=approved
```

Restart the application after you change `MCAC_UI_VARIANT`. Development builds
also accept `?ui=approved` or `?ui=polished` and keep the selection for the
current browser tab. Set `MCAC_UI_PREVIEW=1` to allow this preview switch in a
production build. Do not enable the production preview switch without client
approval.

The development environment uses fictional, AI-generated demo media from
`public/demo/`. The files do not show real members or client operations.
`src/db/seed.ts` maps four portraits to fictional seed accounts. Production
must set `MCAC_DEMO_MEDIA=1` to show fictional post images. Leave it unset for
real member data. Demo media does not change post data, attachments, search,
or permissions.

Deployment notes for the GoDaddy preview spike, including the scheduler gap
and the production approval gates, live in
`../docs/deployment/godaddy-nodejs-spike.md`.

Never run `pnpm db:seed` against production. After migrations and `db:push`,
set the bootstrap variables from `.env.example` and run `pnpm db:bootstrap`.
The command installs the current disclosure and expertise taxonomy without
creating users or deleting existing data. Registration may use
`docs/interim-privacy-disclosure.md` while the final notice is pending:
applicants remain pending with no member access until an administrator
explicitly approves them. `/api/health` intentionally remains unready while
the interim disclosure is current. Publishing the final notice as a new
version requires applicants and members to accept that current version.

## Security model (summary)

- Sessions prove identity only; every request reloads the user row (`getViewer`), so approval revocation is immediate.
- All reads/writes go through `src/lib/**` services that fail closed via `memberAccessError` / `adminAccessError` (permission matrix).
- Pending/rejected/suspended accounts reach only their own status screens.
- Contact fields are projected per member choice (visible / hidden / admin-only); hidden values are never serialized to the client.
- Attachments live behind authorized downloads with random object keys; no public URLs.
- Consent is versioned and insert-only; approval is blocked until the current notice is accepted.
