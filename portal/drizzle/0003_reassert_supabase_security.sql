-- Reassert the production security boundary after the application tables exist.
--
-- 0001 establishes fail-closed default privileges, but it precedes the
-- generated application schema in 0002. Keep these statements explicit so a
-- brand-new database finishes in the same secured state as production.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;

ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookmarks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expertise_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "link_intents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_section_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "post_tagged_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "privacy_notices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification_tokens" ENABLE ROW LEVEL SECURITY;

-- Remove the temporary dashboard helper that triggered Security Advisor's
-- public/authenticated function-execution warnings. It is not part of the app.
DROP FUNCTION IF EXISTS public.rls_auto_enable();
