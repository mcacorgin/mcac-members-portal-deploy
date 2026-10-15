-- Issue #82: backfill Indian national phone numbers to E.164.
--
-- Only rows that are clearly Indian national numbers are touched:
--   10 digits starting 6-9            -> +91<digits>
--   11 digits, leading 0 + 6-9...    -> +91<digits without the trunk 0>
--   12 digits, leading 91 + 6-9...   -> +<digits> (country code without +)
-- Rows already starting with + are left alone, so the migration is
-- idempotent and safe to re-run. Anything ambiguous (foreign numbers,
-- short codes, garbage) is left untouched for a human to review.
UPDATE "profiles"
SET "phone" = '+91' || CASE
  WHEN digits ~ '^0[6-9][0-9]{9}$' THEN substring(digits from 2)
  WHEN digits ~ '^91[6-9][0-9]{9}$' THEN substring(digits from 3)
  ELSE digits
END
FROM (
  SELECT "user_id", regexp_replace("phone", '\D', '', 'g') AS digits
  FROM "profiles"
) AS normalized
WHERE "profiles"."user_id" = normalized."user_id"
  AND "profiles"."phone" NOT LIKE '+%'
  AND (
    normalized.digits ~ '^[6-9][0-9]{9}$'
    OR normalized.digits ~ '^0[6-9][0-9]{9}$'
    OR normalized.digits ~ '^91[6-9][0-9]{9}$'
  );--> statement-breakpoint
