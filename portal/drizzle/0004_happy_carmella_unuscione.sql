CREATE TABLE "auth_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);

-- Keep the shared authentication limiter behind the same server-only boundary
-- as the rest of the application schema.
REVOKE ALL PRIVILEGES ON TABLE "auth_rate_limits" FROM anon, authenticated;
ALTER TABLE "auth_rate_limits" ENABLE ROW LEVEL SECURITY;
