import { and, asc, eq, isNull, lte } from "drizzle-orm";
import { db, tables } from "@/db";
import { recordAudit } from "@/lib/audit";
import { getStorageDriver } from "./storage";

export const ATTACHMENT_RETENTION_DAYS = 60;

export type RetentionMode = "dry-run" | "delete";

export type RetentionCandidate = {
  id: string;
  postId: string;
  objectKey: string;
  sizeBytes: number;
  createdAt: Date;
  retentionExempt: boolean;
  purgedAt: Date | null;
};

export type RetentionRunResult = {
  mode: RetentionMode;
  eligible: number;
  purged: number;
  failed: number;
  skipped: number;
  eligibleBytes: number;
  purgedBytes: number;
};

export function resolveRetentionMode(value: string | undefined): RetentionMode {
  return value === "delete" ? "delete" : "dry-run";
}

export function attachmentRetentionCutoff(now: Date): Date {
  return new Date(
    now.getTime() - ATTACHMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
}

export function isRetentionDue(
  candidate: RetentionCandidate,
  now: Date,
): boolean {
  return (
    !candidate.retentionExempt &&
    candidate.purgedAt === null &&
    candidate.createdAt.getTime() <= attachmentRetentionCutoff(now).getTime()
  );
}

export async function processRetentionCandidates(
  candidates: RetentionCandidate[],
  options: {
    now: Date;
    mode: RetentionMode;
    deleteObject: (objectKey: string) => Promise<void>;
    markPurgedAndAudit: (
      candidate: RetentionCandidate,
      purgedAt: Date,
    ) => Promise<boolean>;
  },
): Promise<RetentionRunResult> {
  const result: RetentionRunResult = {
    mode: options.mode,
    eligible: 0,
    purged: 0,
    failed: 0,
    skipped: 0,
    eligibleBytes: 0,
    purgedBytes: 0,
  };

  for (const candidate of candidates) {
    if (!isRetentionDue(candidate, options.now)) {
      result.skipped += 1;
      continue;
    }
    result.eligible += 1;
    result.eligibleBytes += candidate.sizeBytes;
    if (options.mode === "dry-run") continue;

    try {
      // Delete first. A failed object deletion must never be recorded as a
      // successful purge. Repeating a delete is safe: the driver accepts 404.
      await options.deleteObject(candidate.objectKey);
      const marked = await options.markPurgedAndAudit(candidate, options.now);
      if (marked) {
        result.purged += 1;
        result.purgedBytes += candidate.sizeBytes;
      } else {
        result.skipped += 1;
      }
    } catch (error) {
      result.failed += 1;
      console.error(`[retention] attachment ${candidate.id} purge failed`, error);
    }
  }

  return result;
}

export async function runAttachmentRetention(options?: {
  now?: Date;
  mode?: RetentionMode;
  limit?: number;
}): Promise<RetentionRunResult> {
  const now = options?.now ?? new Date();
  const mode =
    options?.mode ?? resolveRetentionMode(process.env.ATTACHMENT_RETENTION_MODE);
  const limit = Math.min(Math.max(options?.limit ?? 200, 1), 1000);
  const cutoff = attachmentRetentionCutoff(now);

  const candidates = await db
    .select({
      id: tables.attachments.id,
      postId: tables.attachments.postId,
      objectKey: tables.attachments.objectKey,
      sizeBytes: tables.attachments.sizeBytes,
      createdAt: tables.attachments.createdAt,
      retentionExempt: tables.posts.retentionExempt,
      purgedAt: tables.attachments.purgedAt,
    })
    .from(tables.attachments)
    .innerJoin(tables.posts, eq(tables.attachments.postId, tables.posts.id))
    .where(
      and(
        eq(tables.posts.retentionExempt, false),
        isNull(tables.attachments.purgedAt),
        lte(tables.attachments.createdAt, cutoff),
      ),
    )
    .orderBy(asc(tables.attachments.createdAt), asc(tables.attachments.id))
    .limit(limit);

  const storage = getStorageDriver();
  return processRetentionCandidates(candidates, {
    now,
    mode,
    deleteObject: (objectKey) => storage.delete(objectKey),
    markPurgedAndAudit: async (candidate, purgedAt) =>
      db.transaction(async (tx) => {
        const [updated] = await tx
          .update(tables.attachments)
          .set({ purgedAt })
          .where(
            and(
              eq(tables.attachments.id, candidate.id),
              isNull(tables.attachments.purgedAt),
            ),
          )
          .returning({ id: tables.attachments.id });
        if (!updated) return false;
        await recordAudit(
          {
            actorId: null,
            action: "attachment.retention_purge",
            subjectType: "attachment",
            subjectId: candidate.id,
            detail: {
              postId: candidate.postId,
              sizeBytes: candidate.sizeBytes,
              retentionDays: ATTACHMENT_RETENTION_DAYS,
            },
          },
          tx,
        );
        return true;
      }),
  });
}
