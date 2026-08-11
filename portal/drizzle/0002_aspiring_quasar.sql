CREATE TYPE "public"."account_status" AS ENUM('pending', 'approved', 'rejected', 'needs_changes', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."field_visibility" AS ENUM('visible', 'hidden', 'admin_only');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('active', 'old', 'removed');--> statement-breakpoint
CREATE TYPE "public"."post_type" AS ENUM('opportunity', 'job', 'knowledge', 'event');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('member', 'admin');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "app_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT timezone('utc', now()) NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" text NOT NULL,
	"uploader_id" text NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"object_key" text NOT NULL,
	"created_at" timestamp DEFAULT timezone('utc', now()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT timezone('utc', now()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"user_id" text NOT NULL,
	"post_id" text NOT NULL,
	"created_at" timestamp DEFAULT timezone('utc', now()) NOT NULL,
	CONSTRAINT "bookmarks_user_id_post_id_pk" PRIMARY KEY("user_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" text NOT NULL,
	"author_id" text NOT NULL,
	"parent_id" text,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT timezone('utc', now()) NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"notice_version" integer NOT NULL,
	"accepted_at" timestamp DEFAULT timezone('utc', now()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expertise_tags" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_intents" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT timezone('utc', now()) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_section_overrides" (
	"user_id" text NOT NULL,
	"section" "post_type" NOT NULL,
	"enabled" boolean NOT NULL,
	CONSTRAINT "member_section_overrides_user_id_section_pk" PRIMARY KEY("user_id","section")
);
--> statement-breakpoint
CREATE TABLE "member_tags" (
	"user_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "member_tags_user_id_tag_id_pk" PRIMARY KEY("user_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT timezone('utc', now()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT timezone('utc', now()) NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "post_tagged_members" (
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "post_tagged_members_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "post_type" NOT NULL,
	"author_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "post_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp,
	"removed_reason" text,
	"last_edited_by_id" text,
	"last_edited_at" timestamp,
	"created_at" timestamp DEFAULT timezone('utc', now()) NOT NULL,
	"updated_at" timestamp DEFAULT timezone('utc', now()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "privacy_notices" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"body" text NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"published_at" timestamp DEFAULT timezone('utc', now()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"linkedin_url" text DEFAULT '' NOT NULL,
	"phone_visibility" "field_visibility" DEFAULT 'hidden' NOT NULL,
	"email_visibility" "field_visibility" DEFAULT 'admin_only' NOT NULL,
	"linkedin_visibility" "field_visibility" DEFAULT 'visible' NOT NULL,
	"contact_choices_at" timestamp,
	"onboarding_completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"image" text,
	"password_hash" text,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"status" "account_status" DEFAULT 'pending' NOT NULL,
	"status_reason" text,
	"status_changed_at" timestamp,
	"credentials_changed_at" timestamp,
	"created_at" timestamp DEFAULT timezone('utc', now()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_intents" ADD CONSTRAINT "link_intents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_section_overrides" ADD CONSTRAINT "member_section_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_tags" ADD CONSTRAINT "member_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_tags" ADD CONSTRAINT "member_tags_tag_id_expertise_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."expertise_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_tagged_members" ADD CONSTRAINT "post_tagged_members_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_tagged_members" ADD CONSTRAINT "post_tagged_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_last_edited_by_id_users_id_fk" FOREIGN KEY ("last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_user_provider_idx" ON "accounts" USING btree ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_object_key_idx" ON "attachments" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "attachments_post_idx" ON "attachments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "audit_log_subject_idx" ON "audit_log" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "comments_post_idx" ON "comments" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "consent_records_user_idx" ON "consent_records" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expertise_tags_label_idx" ON "expertise_tags" USING btree ("label");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "outbox_events_pending_idx" ON "outbox_events" USING btree ("processed_at","id");--> statement-breakpoint
CREATE INDEX "post_tagged_members_user_idx" ON "post_tagged_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "posts_type_status_idx" ON "posts" USING btree ("type","status","created_at");--> statement-breakpoint
CREATE INDEX "posts_author_idx" ON "posts" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "privacy_notices_version_idx" ON "privacy_notices" USING btree ("version");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");