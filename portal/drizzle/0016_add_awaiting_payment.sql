-- Paid membership (December 2026 release). Adds the awaiting_payment account
-- status and two columns that record the annual fee. This file only adds
-- schema: no account changes status here, so shipping it early is safe.
-- Moving the existing members to awaiting_payment is a separate, deliberate
-- step (docs/operations/membership-payment-cutover.md). Safe to re-run.
-- Apply with psql --single-transaction. Postgres 12+ lets ADD VALUE run inside
-- a transaction; the new value cannot be used until that transaction commits.
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
ALTER TYPE "public"."account_status" ADD VALUE IF NOT EXISTS 'awaiting_payment';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "membership_paid_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "membership_valid_until" timestamp;
