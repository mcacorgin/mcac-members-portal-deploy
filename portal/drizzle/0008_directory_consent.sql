ALTER TABLE "profiles" ADD COLUMN "directory_listed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "directory_decided_at" timestamp;--> statement-breakpoint
-- Accounts that predate the 2026-08-15 notice were listed in the member
-- directory under the interim disclosure, so removing them silently would be
-- the wrong default. They stay listed; directory_decided_at stays null, which
-- is how "never answered" remains distinguishable from "answered yes".
UPDATE "profiles" SET "directory_listed" = true WHERE "directory_decided_at" IS NULL;
