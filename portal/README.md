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
pnpm dev
```

`pnpm db:migrate` is the reproducible database setup path in local and hosted
environments. The ordered migrations under `drizzle/` install `pg_trgm`,
create the application schema, and apply the fail-closed Supabase security
boundary. Production bootstrap is a separate, explicit operation and must use
only approved client data.

Future schema changes must be generated and reviewed as ordered Drizzle
migrations.

Readiness check:

```sql
SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';
```

### Scripts

- `pnpm typecheck` / `pnpm lint` - static checks
- `pnpm db:migrate` - apply the reviewed schema and security history
- `pnpm db:bootstrap` - idempotent production reference data and first administrator; never deletes data
- `GET /api/jobs/run` - Vercel Cron sweep, authorized by `CRON_SECRET`
- `POST /api/jobs/run` - external scheduler or administrator sweep, authorized by `JOBS_SECRET` or an admin session
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

After migrations, set the bootstrap variables from `.env.example` and run
`pnpm db:bootstrap` from a trusted operator environment.
The command requires final privacy text, creates the expertise taxonomy, and
creates the first approved administrator without deleting existing data.

## Security model (summary)

- Sessions prove identity only; every request reloads the user row (`getViewer`), so approval revocation is immediate.
- All reads/writes go through `src/lib/**` services that fail closed via `memberAccessError` / `adminAccessError` (permission matrix).
- Pending/rejected/suspended accounts reach only their own status screens.
- Contact fields are projected per member choice (visible / hidden / admin-only); hidden values are never serialized to the client.
- Attachments live behind authorized downloads with random object keys; no public URLs.
- Consent is versioned and insert-only; approval is blocked until the current notice is accepted.
