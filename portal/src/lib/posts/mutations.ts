import { db, tables } from "@/db";
import { and, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import {
  adminAccessError,
  hasAdminRole,
  memberAccessError,
  sectionEnabledFor,
  type Viewer,
} from "@/lib/authz";
import { ok, err, type ActionResult } from "@/lib/contracts/result";
import { getConfig } from "@/lib/config";
import { emitEvent } from "@/lib/outbox";
import { recordAudit } from "@/lib/audit";
import {
  createPostInputSchema,
  TYPE_CONFIG,
  updatePostBaseInputSchema,
  validateUpdatePostMetadata,
  type CreatePostInput,
  type UpdatePostInput,
} from "./types";
import { isMandateOpportunityMetadata } from "./opportunity";

// Authorized writes for the posts kernel. Every function validates input,
// fails closed via the central authz API, and keeps domain write + outbox
// event in one transaction (docs/build/events.md).

type PostRow = typeof tables.posts.$inferSelect;

function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export async function createPost(
  viewer: Viewer | null,
  input: CreatePostInput,
): Promise<ActionResult<PostRow>> {
  const accessErr = memberAccessError(viewer);
  if (accessErr) return err(accessErr, "You cannot create posts.");
  const v = viewer!;

  const parsed = createPostInputSchema.safeParse(input);
  if (!parsed.success) {
    return err("validation", "Check the highlighted fields.", fieldErrorsOf(parsed.error));
  }
  const { type, title, body, metadata } = parsed.data;

  if (!(await sectionEnabledFor(type, v.id))) {
    return err("section_disabled", "This section is not available.");
  }

  const capabilities = TYPE_CONFIG[type].capabilities;
  const taggedUserIds = [...new Set(parsed.data.taggedUserIds)].filter(
    (id) => id !== v.id,
  );
  if (taggedUserIds.length > 0 && !capabilities.tagging) {
    return err("validation", "This post type does not support tagging.", {
      taggedUserIds: ["Tagging is not available for this post type."],
    });
  }
  if (taggedUserIds.length > 0) {
    const approved = await db
      .select({ id: tables.users.id })
      .from(tables.users)
      .where(
        and(
          inArray(tables.users.id, taggedUserIds),
          eq(tables.users.status, "approved"),
        ),
      );
    if (approved.length !== taggedUserIds.length) {
      return err("validation", "Tagged members must be approved members.", {
        taggedUserIds: ["One or more tagged members are not approved members."],
      });
    }
  }

  const expiryDays =
    type === "opportunity"
      ? await getConfig("posts.opportunityExpiryDays")
      : type === "job"
        ? await getConfig("posts.jobExpiryDays")
        : null;
  const expiresAt = capabilities.expiry && expiryDays
    ? new Date(Date.now() + expiryDays * 86400000)
    : null;

  const post = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(tables.posts)
      .values({ type, authorId: v.id, title, body, metadata, expiresAt })
      .returning();
    if (taggedUserIds.length > 0) {
      await tx
        .insert(tables.postTaggedMembers)
        .values(taggedUserIds.map((userId) => ({ postId: created.id, userId })));
      await tx.insert(tables.notifications).values(
        taggedUserIds.map((userId) => ({
          userId,
          type: "tagged",
          payload: {
            postId: created.id,
            postTitle: created.title,
            postType: created.type,
          },
        })),
      );
      await emitEvent(tx, "post.tagged", {
        postId: created.id,
        postType: created.type,
        postTitle: created.title,
        authorId: v.id,
        taggedUserIds,
      });
    }
    return created;
  });

  return ok(post);
}

const addCommentInputSchema = z.object({
  postId: z.uuid(),
  body: z.string().min(1).max(2000),
  parentId: z.uuid().optional(),
});

export type AddCommentInput = z.input<typeof addCommentInputSchema>;

type CommentRow = typeof tables.comments.$inferSelect;

export async function addComment(
  viewer: Viewer | null,
  input: AddCommentInput,
): Promise<ActionResult<CommentRow>> {
  const accessErr = memberAccessError(viewer);
  if (accessErr) return err(accessErr, "You cannot comment.");
  const v = viewer!;

  const parsed = addCommentInputSchema.safeParse(input);
  if (!parsed.success) {
    return err("validation", "Check the highlighted fields.", fieldErrorsOf(parsed.error));
  }
  const { postId, body, parentId } = parsed.data;

  const post = await db.query.posts.findFirst({
    where: eq(tables.posts.id, postId),
  });
  if (!post || post.status === "removed") {
    return err("not_found", "Post not found.");
  }
  if (!(await sectionEnabledFor(post.type, v.id))) {
    return err("section_disabled", "This section is not available.");
  }
  if (!TYPE_CONFIG[post.type].capabilities.comments) {
    return err("forbidden", "Comments are not available for this post type.");
  }

  let parent: CommentRow | undefined;
  if (parentId) {
    parent = await db.query.comments.findFirst({
      where: eq(tables.comments.id, parentId),
    });
    if (!parent || parent.postId !== postId || parent.deletedAt) {
      return err("not_found", "Comment not found.");
    }
    if (parent.parentId) {
      return err("validation", "Replies can only go one level deep.", {
        parentId: ["Reply to the top-level comment instead."],
      });
    }
  }

  const comment = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(tables.comments)
      .values({ postId, authorId: v.id, body, parentId: parentId ?? null })
      .returning();

    // Never notify the actor about their own activity.
    if (parent) {
      if (parent.authorId !== v.id) {
        await tx.insert(tables.notifications).values({
          userId: parent.authorId,
          type: "reply",
          payload: {
            postId,
            postTitle: post.title,
            postType: post.type,
            commentId: created.id,
          },
        });
        await emitEvent(tx, "comment.reply", {
          postId,
          postTitle: post.title,
          commentId: created.id,
          parentAuthorId: parent.authorId,
          authorId: v.id,
        });
      }
    } else if (post.authorId !== v.id) {
      await tx.insert(tables.notifications).values({
        userId: post.authorId,
        type: "comment",
        payload: {
          postId,
          postTitle: post.title,
          postType: post.type,
          commentId: created.id,
        },
      });
      await emitEvent(tx, "post.comment", {
        postId,
        postTitle: post.title,
        commentId: created.id,
        authorId: v.id,
        postAuthorId: post.authorId,
      });
    }
    return created;
  });

  return ok(comment);
}

export async function toggleBookmark(
  viewer: Viewer | null,
  postId: string,
): Promise<ActionResult<{ bookmarked: boolean }>> {
  const accessErr = memberAccessError(viewer);
  if (accessErr) return err(accessErr, "You cannot bookmark posts.");
  const v = viewer!;

  const post = await db.query.posts.findFirst({
    where: eq(tables.posts.id, postId),
    columns: { id: true, type: true, status: true },
  });
  if (!post || (post.status === "removed" && !hasAdminRole(v.role))) {
    return err("not_found", "Post not found.");
  }
  if (!(await sectionEnabledFor(post.type, v.id))) {
    return err("section_disabled", "This section is not available.");
  }
  if (!TYPE_CONFIG[post.type].capabilities.bookmarks) {
    return err("forbidden", "Bookmarks are not available for this post type.");
  }

  const deleted = await db
    .delete(tables.bookmarks)
    .where(
      and(
        eq(tables.bookmarks.userId, v.id),
        eq(tables.bookmarks.postId, postId),
      ),
    )
    .returning();
  if (deleted.length > 0) return ok({ bookmarked: false });

  await db
    .insert(tables.bookmarks)
    .values({ userId: v.id, postId })
    .onConflictDoNothing();
  return ok({ bookmarked: true });
}

export async function deleteOwnComment(
  viewer: Viewer | null,
  commentId: string,
): Promise<ActionResult<void>> {
  const accessErr = memberAccessError(viewer);
  if (accessErr) return err(accessErr, "You cannot delete comments.");
  const v = viewer!;

  const comment = await db.query.comments.findFirst({
    where: eq(tables.comments.id, commentId),
  });
  if (!comment || comment.deletedAt) return err("not_found", "Comment not found.");
  if (comment.authorId !== v.id && !hasAdminRole(v.role)) {
    return err("forbidden", "Only the comment author or an admin can delete this.");
  }

  await db
    .update(tables.comments)
    .set({ deletedAt: new Date() })
    .where(eq(tables.comments.id, commentId));
  if (comment.authorId !== v.id) {
    const { recordAudit } = await import("@/lib/audit");
    await recordAudit({
      actorId: v.id,
      action: "comment.admin_delete",
      subjectType: "comment",
      subjectId: commentId,
      detail: { postId: comment.postId, authorId: comment.authorId },
    });
  }
  return ok(undefined);
}

export async function updatePost(
  viewer: Viewer | null,
  input: UpdatePostInput,
): Promise<ActionResult<PostRow>> {
  const accessErr = memberAccessError(viewer);
  if (accessErr) return err(accessErr, "You cannot edit posts.");
  const v = viewer!;

  const parsed = updatePostBaseInputSchema.safeParse(input);
  if (!parsed.success) {
    return err("validation", "Check the highlighted fields.", fieldErrorsOf(parsed.error));
  }
  const { postId, title, body, metadata } = parsed.data;

  try {
    return await db.transaction(async (tx) => {
      const [post] = await tx
        .select()
        .from(tables.posts)
        .where(eq(tables.posts.id, postId))
        .for("update");
      if (!post || post.status === "removed") {
        return err("not_found", "Post not found.");
      }

      if (!hasAdminRole(v.role)) {
        if (post.authorId !== v.id) {
          return err("forbidden", "Only the author or an admin can edit this post.");
        }
        if (!(await sectionEnabledFor(post.type, v.id, tx))) {
          return err("section_disabled", "This section is not available.");
        }
      }

      const meta = validateUpdatePostMetadata(post.type, metadata);
      if (!meta.ok) {
        return err("validation", "Check the highlighted fields.", meta.fieldErrors);
      }
      if (
        post.type === "opportunity" &&
        isMandateOpportunityMetadata(post.metadata as Record<string, unknown>) &&
        !isMandateOpportunityMetadata(meta.metadata)
      ) {
        return err("validation", "Check the highlighted fields.", {
          "metadata.mandateType": [
            "A structured mandate must keep its opportunity type.",
          ],
        });
      }

      const [updated] = await tx
        .update(tables.posts)
        .set({
          title,
          body,
          metadata: meta.metadata,
          lastEditedById: v.id,
          lastEditedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tables.posts.id, postId))
        .returning();

      await recordAudit(
        {
          actorId: v.id,
          action: "post.edit",
          subjectType: "post",
          subjectId: postId,
          detail: {
            previousTitle: post.title,
            previousBody: post.body,
            previousMetadata: post.metadata,
          },
        },
        tx,
      );
      return ok(updated);
    });
  } catch {
    return err("internal", "The edit could not be saved.");
  }
}

export async function removePost(
  admin: Viewer | null,
  postId: string,
  reason: string,
): Promise<ActionResult<void>> {
  const accessErr = adminAccessError(admin);
  if (accessErr) return err(accessErr, "Only admins can remove posts.");
  const a = admin!;

  const trimmed = reason.trim();
  if (!trimmed) {
    return err("validation", "A removal reason is required.", {
      reason: ["A removal reason is required."],
    });
  }

  const post = await db.query.posts.findFirst({
    where: eq(tables.posts.id, postId),
    columns: { id: true, status: true },
  });
  if (!post) return err("not_found", "Post not found.");

  await db
    .update(tables.posts)
    .set({ status: "removed", removedReason: trimmed, updatedAt: new Date() })
    .where(eq(tables.posts.id, postId));
  await recordAudit({
    actorId: a.id,
    action: "post.remove",
    subjectType: "post",
    subjectId: postId,
    detail: { reason: trimmed, previousStatus: post.status },
  });
  return ok(undefined);
}

export async function setPostRetentionExempt(
  admin: Viewer | null,
  postId: string,
  exempt: boolean,
): Promise<ActionResult<void>> {
  const accessErr = adminAccessError(admin);
  if (accessErr) return err(accessErr, "Only admins can change retention.");
  const a = admin!;

  const [updated] = await db
    .update(tables.posts)
    .set({ retentionExempt: exempt, updatedAt: new Date() })
    .where(eq(tables.posts.id, postId))
    .returning({ id: tables.posts.id });
  if (!updated) return err("not_found", "Post not found.");

  await recordAudit({
    actorId: a.id,
    action: "post.retention_exemption_set",
    subjectType: "post",
    subjectId: postId,
    detail: { exempt },
  });
  return ok(undefined);
}

/** Archive expired active opportunities and jobs. Called by a cron route. */
export async function runExpirySweep(): Promise<number> {
  const swept = await db
    .update(tables.posts)
    .set({ status: "old", updatedAt: new Date() })
    .where(
      and(
        inArray(tables.posts.type, ["opportunity", "job"]),
        eq(tables.posts.status, "active"),
        lt(tables.posts.expiresAt, new Date()),
      ),
    )
    .returning({ id: tables.posts.id });
  return swept.length;
}
