import { db, tables, type DbOrTx } from "@/db";

// Admin/audit trail helper (orchestrator-owned). Record every privileged
// transition: account status changes, moderation, policy/config edits, exports.

export async function recordAudit(
  entry: {
    actorId: string | null;
    action: string; // e.g. "account.approve", "post.remove", "config.set"
    subjectType: string; // "user" | "post" | "config" | ...
    subjectId: string;
    detail?: Record<string, unknown>;
  },
  dbOrTx: DbOrTx = db,
): Promise<void> {
  await dbOrTx.insert(tables.auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    subjectType: entry.subjectType,
    subjectId: entry.subjectId,
    detail: entry.detail ?? {},
  });
}
