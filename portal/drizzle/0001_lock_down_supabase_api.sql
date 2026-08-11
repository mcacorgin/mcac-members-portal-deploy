-- The portal accesses PostgreSQL only through its server-side DATABASE_URL.
-- Supabase's browser-facing anon/authenticated roles must never read or write
-- these tables directly. RLS with no policies is the fail-closed backstop;
-- revoking grants also removes the tables from the Data API roles entirely.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;

DO $hardening$
DECLARE
  table_row record;
BEGIN
  FOR table_row IN
    SELECT format('%I.%I', schemaname, tablename) AS qualified_name
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE 'ALTER TABLE ' || table_row.qualified_name ||
      ' ENABLE ROW LEVEL SECURITY';
  END LOOP;
END
$hardening$;
