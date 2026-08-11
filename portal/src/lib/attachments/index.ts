import { db, tables } from "@/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { memberAccessError, sectionEnabledFor, type Viewer } from "@/lib/authz";
import { ok, err, type ActionResult } from "@/lib/contracts/result";
import { TYPE_CONFIG } from "@/lib/posts/types";
import { getStorageDriver, makeObjectKey } from "./storage";

// Authorized attachment upload/download (FILE-01, docs/build/attachments.md).
// Object keys are random and never public; every download authorizes first.

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_MIMES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

const saveAttachmentInputSchema = z.object({
  postId: z.uuid(),
  filename: z.string().min(1).max(255),
  mime: z.enum(ALLOWED_ATTACHMENT_MIMES),
  sizeBytes: z.number().int().min(1).max(MAX_ATTACHMENT_BYTES),
});

export type SaveAttachmentInput = z.input<typeof saveAttachmentInputSchema> & {
  bytes: Uint8Array;
};

type AttachmentRow = typeof tables.attachments.$inferSelect;

function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export async function saveAttachment(
  viewer: Viewer | null,
  input: SaveAttachmentInput,
): Promise<ActionResult<AttachmentRow>> {
  const accessErr = memberAccessError(viewer);
  if (accessErr) return err(accessErr, "You cannot upload attachments.");
  const v = viewer!;

  const { bytes, ...rest } = input;
  const parsed = saveAttachmentInputSchema.safeParse(rest);
  if (!parsed.success) {
    return err("validation", "Check the highlighted fields.", fieldErrorsOf(parsed.error));
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    return err("validation", "Attachments are limited to 10 MB.", {
      sizeBytes: ["Attachments are limited to 10 MB."],
    });
  }
  const { postId, filename, mime } = parsed.data;

  const post = await db.query.posts.findFirst({
    where: eq(tables.posts.id, postId),
    columns: { id: true, type: true, status: true, authorId: true },
  });
  if (!post || (post.status === "removed" && v.role !== "admin")) {
    return err("not_found", "Post not found.");
  }
  if (post.authorId !== v.id && v.role !== "admin") {
    return err("forbidden", "Only the post author or an admin can attach files.");
  }
  if (!(await sectionEnabledFor(post.type, v.id))) {
    return err("section_disabled", "This section is not available.");
  }
  if (!TYPE_CONFIG[post.type].capabilities.attachments) {
    return err("forbidden", "Attachments are not available for this post type.");
  }

  const objectKey = makeObjectKey(postId);
  const driver = getStorageDriver();
  await driver.put(objectKey, bytes, mime);
  try {
    const [row] = await db
      .insert(tables.attachments)
      .values({
        postId,
        uploaderId: v.id,
        filename,
        mime,
        sizeBytes: bytes.byteLength,
        objectKey,
      })
      .returning();
    return ok(row);
  } catch (e) {
    // Do not leave an orphan object if the row insert fails.
    await driver.delete(objectKey).catch(() => undefined);
    throw e;
  }
}

export type AttachmentDownload = {
  attachment: AttachmentRow;
  stream?: ReadableStream<Uint8Array>;
  signedUrl?: string;
};

export async function getAttachmentForDownload(
  viewer: Viewer | null,
  attachmentId: string,
): Promise<ActionResult<AttachmentDownload>> {
  const accessErr = memberAccessError(viewer);
  if (accessErr) return err(accessErr, "You cannot download attachments.");
  const v = viewer!;

  const [row] = await db
    .select({
      attachment: tables.attachments,
      postType: tables.posts.type,
      postStatus: tables.posts.status,
    })
    .from(tables.attachments)
    .innerJoin(tables.posts, eq(tables.attachments.postId, tables.posts.id))
    .where(eq(tables.attachments.id, attachmentId))
    .limit(1);

  if (!row) return err("not_found", "Attachment not found.");
  if (row.postStatus === "removed" && v.role !== "admin") {
    return err("not_found", "Attachment not found.");
  }
  if (!(await sectionEnabledFor(row.postType, v.id))) {
    return err("section_disabled", "This section is not available.");
  }
  if (row.attachment.purgedAt) {
    return err("not_found", "This attachment expired after 60 days.");
  }

  const driver = getStorageDriver();
  if (driver.getSignedUrl) {
    return ok({
      attachment: row.attachment,
      signedUrl: await driver.getSignedUrl(row.attachment.objectKey),
    });
  }
  if (driver.getStream) {
    return ok({
      attachment: row.attachment,
      stream: await driver.getStream(row.attachment.objectKey),
    });
  }
  return err("internal", "Storage driver cannot deliver files.");
}
