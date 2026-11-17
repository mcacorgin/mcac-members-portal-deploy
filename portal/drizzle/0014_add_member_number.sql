-- Safe to run more than once: the column and the index are only created when
-- they are missing, and the numbering below only fills rows without a number.
-- Apply with psql --single-transaction so a failure leaves nothing half done;
-- see docs/operations/production-runbook.md, "Applying a raw SQL migration".
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "member_number" integer;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_member_number_idx" ON "users" USING btree ("member_number");--> statement-breakpoint
-- Number existing members in order of joining (account creation), oldest
-- first. Approved and suspended accounts were approved at some point, so
-- both get a number. Re-running is safe: only rows without a number are
-- numbered, continuing after the current highest number.
-- Same key as assignMemberNumber (src/lib/account/member-number.ts), so a live
-- approval cannot pick a number while this runs.
SELECT pg_advisory_xact_lock(1835229539);--> statement-breakpoint
WITH numbered AS (
  SELECT "id",
         (SELECT coalesce(max("member_number"), 0) FROM "users")
           + row_number() OVER (ORDER BY "created_at", "id") AS "n"
  FROM "users"
  WHERE "member_number" IS NULL
    AND "status" IN ('approved', 'suspended')
)
UPDATE "users" SET "member_number" = numbered."n"
FROM numbered
WHERE "users"."id" = numbered."id";
