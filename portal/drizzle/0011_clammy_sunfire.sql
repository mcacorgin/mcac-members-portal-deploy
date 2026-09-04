CREATE TABLE "preferred_contact_email_verifications" (
	"user_id" text PRIMARY KEY NOT NULL,
	"pending_email" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "preferred_contact_email_pending_normalized_check" CHECK ("preferred_contact_email_verifications"."pending_email" = lower(btrim("preferred_contact_email_verifications"."pending_email"))),
	CONSTRAINT "preferred_contact_email_expiry_check" CHECK ("preferred_contact_email_verifications"."expires_at" > "preferred_contact_email_verifications"."created_at")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferred_contact_email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferred_contact_email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "preferred_contact_email_verifications" ADD CONSTRAINT "preferred_contact_email_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "preferred_contact_email_token_hash_idx" ON "preferred_contact_email_verifications" USING btree ("token_hash");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_preferred_contact_email_pair_check" CHECK (("users"."preferred_contact_email" is null) = ("users"."preferred_contact_email_verified_at" is null));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_preferred_contact_email_normalized_check" CHECK ("users"."preferred_contact_email" is null or "users"."preferred_contact_email" = lower(btrim("users"."preferred_contact_email")));
--> statement-breakpoint
ALTER TABLE "preferred_contact_email_verifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE "preferred_contact_email_verifications" FROM anon, authenticated;
