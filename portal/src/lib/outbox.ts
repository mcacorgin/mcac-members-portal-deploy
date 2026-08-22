import { tables, type DbOrTx } from "@/db";

// Producer side of the transactional outbox (docs/build/events.md).
// Call INSIDE the same transaction as the domain write:
//   await db.transaction(async (tx) => { ...write...; await emitEvent(tx, name, payload); })

export type OutboxEventName =
  | "account.approved"
  | "account.needs_changes"
  | "account.rejected"
  | "post.tagged"
  | "post.comment"
  | "comment.reply"
  | "comment.mentioned"
  | "account.sections_changed"
  | "account.application_submitted";

export async function emitEvent(
  tx: DbOrTx,
  name: OutboxEventName,
  payload: Record<string, unknown>,
): Promise<void> {
  await tx.insert(tables.outboxEvents).values({
    name,
    payload: { v: 1, ...payload },
  });
}
