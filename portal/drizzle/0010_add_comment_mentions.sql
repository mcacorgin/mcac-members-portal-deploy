CREATE TABLE "comment_mentions" (
	"comment_id" text NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "comment_mentions_comment_id_user_id_pk" PRIMARY KEY("comment_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_mentions_user_idx" ON "comment_mentions" USING btree ("user_id");

-- The portal reads mentions through its server-side DATABASE_URL only. Keep
-- the new relation outside Supabase's browser-facing Data API, matching every
-- other application table.
REVOKE ALL PRIVILEGES ON TABLE "comment_mentions" FROM anon, authenticated;
ALTER TABLE "comment_mentions" ENABLE ROW LEVEL SECURITY;
