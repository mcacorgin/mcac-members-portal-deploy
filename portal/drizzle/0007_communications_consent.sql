ALTER TABLE "profiles" ADD COLUMN "communications_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "communications_decided_at" timestamp;