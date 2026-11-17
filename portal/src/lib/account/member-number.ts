import { eq, isNull, and, sql } from "drizzle-orm";
import { tables, type DbOrTx } from "@/db";

// Assignment of MCAC member numbers. Formatting lives in
// member-number-format.ts so client and unit-test code can import it
// without a database connection.

// Arbitrary constant key for the transaction-scoped advisory lock that
// serialises number assignment, so two admins approving at once cannot
// pick the same "next" number. The unique index is the final backstop.
const MEMBER_NUMBER_LOCK_KEY = 0x6d636163; // "mcac"

/**
 * Give the user the next member number if they do not have one yet. Call
 * inside the approval transaction. A member who is suspended and later
 * re-approved keeps their original number.
 */
export async function assignMemberNumber(
  tx: DbOrTx,
  userId: string,
): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(${MEMBER_NUMBER_LOCK_KEY})`);
  await tx
    .update(tables.users)
    .set({
      memberNumber: sql`(select coalesce(max(${tables.users.memberNumber}), 0) + 1 from ${tables.users})`,
    })
    .where(and(eq(tables.users.id, userId), isNull(tables.users.memberNumber)));
}

/**
 * Number every approved or suspended account that has none, oldest first,
 * after the current highest number. Same rule as migration 0014; used by the
 * local seed, whose fixture rows are inserted after migrations run.
 */
export async function backfillMemberNumbers(tx: DbOrTx): Promise<void> {
  await tx.execute(sql`
    with numbered as (
      select id,
             (select coalesce(max(member_number), 0) from users)
               + row_number() over (order by created_at, id) as n
      from users
      where member_number is null
        and status in ('approved', 'suspended')
    )
    update users set member_number = numbered.n
    from numbered
    where users.id = numbered.id
  `);
}
