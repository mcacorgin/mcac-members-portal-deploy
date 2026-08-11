ALTER TABLE "attachments" ADD COLUMN "purged_at" timestamp;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "retention_exempt" boolean DEFAULT false NOT NULL;