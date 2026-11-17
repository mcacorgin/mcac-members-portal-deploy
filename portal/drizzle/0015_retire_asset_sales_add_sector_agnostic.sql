-- Tracker rows 70 and 72. Retire the expertise tag "Asset Sales & Business
-- Transfers" (members who chose it move to "M&A / Investment Banking") and add
-- the vertical-interest tag "Sector agnostic". Every step is safe to re-run.
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
INSERT INTO "expertise_tags" ("label") VALUES ('M&A / Investment Banking') ON CONFLICT ("label") DO NOTHING;--> statement-breakpoint
INSERT INTO "expertise_tags" ("label") VALUES ('Sector agnostic') ON CONFLICT ("label") DO NOTHING;--> statement-breakpoint
-- Block concurrent member_tags writes while the copy and delete run.
LOCK TABLE "member_tags" IN SHARE ROW EXCLUSIVE MODE;--> statement-breakpoint
-- Move only the rows that still point at the old tag. A member who already
-- has the target tag keeps a single row (the primary key would otherwise clash).
INSERT INTO "member_tags" ("user_id", "tag_id")
SELECT mt."user_id", target."id"
FROM "member_tags" mt
JOIN "expertise_tags" old_tag ON old_tag."id" = mt."tag_id" AND old_tag."label" = 'Asset Sales & Business Transfers'
CROSS JOIN (SELECT "id" FROM "expertise_tags" WHERE "label" = 'M&A / Investment Banking') target
ON CONFLICT DO NOTHING;--> statement-breakpoint
DELETE FROM "member_tags"
WHERE "tag_id" IN (SELECT "id" FROM "expertise_tags" WHERE "label" = 'Asset Sales & Business Transfers');--> statement-breakpoint
-- Drop the old tag only once nothing references it.
DELETE FROM "expertise_tags" t
WHERE t."label" = 'Asset Sales & Business Transfers'
  AND NOT EXISTS (SELECT 1 FROM "member_tags" mt WHERE mt."tag_id" = t."id");
