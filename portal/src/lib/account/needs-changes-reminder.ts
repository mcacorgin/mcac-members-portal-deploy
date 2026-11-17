import { sql } from "drizzle-orm";
import { db } from "@/db";

// Tracker row 67 / Mora note of 15 Oct: an applicant whose application was
// sent back ("needs changes") gets ONE reminder email if they have not
// resubmitted after REMINDER_AFTER_DAYS. The live Phase 1 tracker (row 67,
// revision 44, checked 27 Oct) approves one reminder seven days later.
// Keep the switch off until an authorized operator enables it after deployment.
//
// One-time means once per send-back: the outbox event records the exact
// moment the application was sent back, so a second send-back of the same
// applicant can earn a second reminder, but a daily cron run never repeats
// one. Applications sent back more than REMINDER_WINDOW_DAYS ago get no
// reminder, so switching this on does not email every old applicant at once.

export const REMINDER_AFTER_DAYS = 7;
export const REMINDER_WINDOW_DAYS = 30;
export const REMINDER_EVENT = "account.needs_changes_reminder" as const;

/** Stable text key for one send-back: status_changed_at as epoch millis. */
export function sendBackKey(statusChangedAt: Date): string {
  return String(statusChangedAt.getTime());
}

/**
 * Queue a reminder outbox event for every applicant who is due one. Safe to
 * run repeatedly and concurrently: the transaction-scoped advisory lock and
 * the NOT EXISTS check make a second run a no-op. Returns how many were queued.
 */
export async function queueNeedsChangesReminders(
  now: Date = new Date(),
): Promise<number> {
  const dueBefore = new Date(now.getTime() - REMINDER_AFTER_DAYS * 86_400_000);
  const notBefore = new Date(now.getTime() - REMINDER_WINDOW_DAYS * 86_400_000);
  // status_changed_at is a naive UTC timestamp, so the bounds are converted
  // to naive UTC too; comparing against a timestamptz would shift them by
  // the session time zone.
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${0x6e636872})`);
    const rows = await tx.execute(sql`
      insert into outbox_events (name, payload)
      select ${REMINDER_EVENT},
             jsonb_build_object(
               'v', 1,
               'userId', u.id,
               'sentBackAt',
               (floor(extract(epoch from u.status_changed_at) * 1000))::bigint::text
             )
      from users u
      where u.status = 'needs_changes'
        and u.status_changed_at is not null
        and u.status_changed_at <= (${dueBefore.toISOString()}::timestamptz at time zone 'utc')
        and u.status_changed_at > (${notBefore.toISOString()}::timestamptz at time zone 'utc')
        and not exists (
          select 1 from outbox_events e
          where e.name = ${REMINDER_EVENT}
            and e.payload->>'userId' = u.id
            and e.payload->>'sentBackAt' =
              (floor(extract(epoch from u.status_changed_at) * 1000))::bigint::text
        )
      returning id
    `);
    return rows.length;
  });
}
