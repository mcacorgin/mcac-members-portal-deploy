# MCAC Members Portal

This is the sanitized deployment mirror for the MCAC members portal. The
deployable Next.js application lives in `portal/`.

The repository contains application source and reviewed database migrations.
It intentionally excludes internal planning documents, client records,
credentials, local fixtures, demo accounts, uploads, and production data.

## Production safety

- Run `pnpm db:migrate` from `portal/` to create the empty secured schema.
- Never place credentials in Git; use the deployment provider's encrypted
  environment settings.
- Production bootstrap is explicit and idempotent. It requires the approved
  privacy notice and first administrator details at execution time.
- Do not add seed or demo-member data to production.

For Vercel, import this repository and set the Root Directory to `portal`.
