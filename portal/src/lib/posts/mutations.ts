import { db, tables } from "@/db";
import { and, asc, eq, inArray, lt } from "drizzle-orm";
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
import {
  emitEvent,
  type OutboxDeliveryScheduler,
} from "@/lib/outbox";
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
  scheduleDelivery?: OutboxDeliveryScheduler,
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
    // The retired directory choice is not a tagging gate. A hand-crafted
    // submission must still target approved members only.
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

  const eventIds: number[] = [];
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
      eventIds.push(
        await emitEvent(tx, "post.tagged", {
          postId: created.id,
          postType: created.type,
          postTitle: created.title,
          authorId: v.id,
          taggedUserIds,
        }),
      );
    }
    return created;
  });

  scheduleDelivery?.(eventIds);

  return ok(post);
}

const addCommentInputSchema = z.object({
  postId: z.uuid(),
  body: z.string().min(1).max(2000),
  parentId: z.uuid().optional(),
  mentionedUserIds: z.array(z.uuid()).max(10).default([]),
});

export type AddCommentInput = z.input<typeof addCommentInputSchema>;

type CommentRow = typeof tables.comments.$inferSelect;

export async function addComment(
  viewer: Viewer | null,
  input: AddCommentInput,
  scheduleDelivery?: OutboxDeliveryScheduler,
): Promise<ActionResult<CommentRow>> {
  const accessErr = memberAccessError(viewer);
  if (accessErr) return err(accessErr, "You cannot comment.");
  const v = viewer!;

  const parsed = addCommentInputSchema.safeParse(input);
  if (!parsed.success) {
    return err("validation", "Check the highlighted fields.", fieldErrorsOf(parsed.error));
  }
  const { postId, body, parentId } = parsed.data;
  const mentionedUserIds = [
    ...new Set(parsed.data.mentionedUserIds.filter((id) => id !== v.id)),
  ].sort();

  const eventIds: number[] = [];
  const result = await db.transaction(async (tx) => {
    const [post] = await tx
      .select()
      .from(tables.posts)
      .where(eq(tables.posts.id, postId))
      .for("update");
    if (!post || post.status === "removed") {
      return err("not_found", "Post not found.");
    }
    if (!(await sectionEnabledFor(post.type, v.id, tx))) {
      return err("section_disabled", "This section is not available.");
    }
    if (!TYPE_CONFIG[post.type].capabilities.comments) {
      return err("forbidden", "Comments are not available for this post type.");
    }

    let parent: CommentRow | undefined;
    if (parentId) {
      [parent] = await tx
        .select()
        .from(tables.comments)
        .where(eq(tables.comments.id, parentId))
        .for("update");
      if (!parent || parent.postId !== postId || parent.deletedAt) {
        return err("not_found", "Comment not found.");
      }
      if (parent.parentId) {
        return err("validation", "Replies can only go one level deep.", {
          parentId: ["Reply to the top-level comment instead."],
        });
      }
    }

    const mentionedMembers = mentionedUserIds.length
      ? await tx
          .select({ id: tables.users.id, name: tables.users.name })
          .from(tables.users)
          .where(
            and(
              inArray(tables.users.id, mentionedUserIds),
              eq(tables.users.status, "approved"),
            ),
          )
          .orderBy(asc(tables.users.id))
          .for("update")
      : [];
    if (mentionedMembers.length !== mentionedUserIds.length) {
      return err("validation", "Mentioned members must be approved members.", {
        mentionedUserIds: [
          "One or more mentioned members are unavailable or no longer approved.",
        ],
      });
    }
    const mentionNames = new Set<string>();
    for (const member of mentionedMembers) {
      const key = member.name.trim().toLocaleLowerCase();
      if (!key || mentionNames.has(key)) {
        return err("validation", "Choose unambiguous member mentions.", {
          mentionedUserIds: [
            "Two selected members have the same display name. Mention only one of them in this comment.",
          ],
        });
      }
      mentionNames.add(key);
      if (!body.includes(`@${member.name}`)) {
        return err("validation", "Mention text does not match the selected member.", {
          mentionedUserIds: [
            `Keep @${member.name} in the comment or remove that mention.`,
          ],
        });
      }
    }

    const [created] = await tx
      .insert(tables.comments)
      .values({ postId, authorId: v.id, body, parentId: parentId ?? null })
      .returning();

    if (mentionedUserIds.length > 0) {
      await tx.insert(tables.commentMentions).values(
        mentionedMembers.map((member) => ({
          commentId: created.id,
          userId: member.id,
          label: member.name,
        })),
      );
      await tx.insert(tables.notifications).values(
        mentionedUserIds.map((userId) => ({
          userId,
          type: "mention",
          payload: {
            postId,
            postTitle: post.title,
            postType: post.type,
            commentId: created.id,
            actorName: v.name,
          },
        })),
      );
      eventIds.push(
        await emitEvent(tx, "comment.mentioned", {
          postId,
          postTitle: post.title,
          commentId: created.id,
          authorId: v.id,
          mentionedUserIds,
        }),
      );
    }

    const mentionRecipients = new Set(mentionedUserIds);

    // Never notify the actor about their own activity.
    if (parent) {
      if (parent.authorId !== v.id && !mentionRecipients.has(parent.authorId)) {
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
        eventIds.push(
          await emitEvent(tx, "comment.reply", {
            postId,
            postTitle: post.title,
            commentId: created.id,
            parentAuthorId: parent.authorId,
            authorId: v.id,
          }),
        );
      }
    } else if (post.authorId !== v.id && !mentionRecipients.has(post.authorId)) {
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
      eventIds.push(
        await emitEvent(tx, "post.comment", {
          postId,
          postTitle: post.title,
          commentId: created.id,
          authorId: v.id,
          postAuthorId: post.authorId,
        }),
      );
    }
    return ok(created);
  });
  scheduleDelivery?.(eventIds);
  return result;
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

const editOwnCommentInputSchema = z.object({
  commentId: z.uuid(),
  body: z.string().min(1).max(2000),
});

export type EditOwnCommentInput = z.input<typeof editOwnCommentInputSchema>;

export async function editOwnComment(
  viewer: Viewer | null,
  input: EditOwnCommentInput,
): Promise<ActionResult<CommentRow>> {
  const accessErr = memberAccessError(viewer);
  if (accessErr) return err(accessErr, "You cannot edit comments.");
  const v = viewer!;

  const parsed = editOwnCommentInputSchema.safeParse(input);
  if (!parsed.success) {
    return err("validation", "Check the highlighted fields.", fieldErrorsOf(parsed.error));
  }
  const { commentId, body } = parsed.data;

  return db.transaction(async (tx) => {
    const [comment] = await tx
      .select()
      .from(tables.comments)
      .where(eq(tables.comments.id, commentId))
      .for("update");
    if (!comment || comment.deletedAt) {
      return err("not_found", "Comment not found.");
    }
    // Author-of-comment only: post authors and admins get no extra edit power.
    if (comment.authorId !== v.id) {
      return err("forbidden", "Only the comment author can edit this.");
    }

    const [reply] = await tx
      .select({ id: tables.comments.id })
      .from(tables.comments)
      .where(eq(tables.comments.parentId, commentId))
      .limit(1);
    if (reply) {
      return err("forbidden", "A comment with replies can no longer be edited.");
    }

    const currentMentions = await tx
      .select({
        userId: tables.commentMentions.userId,
        label: tables.commentMentions.label,
      })
      .from(tables.commentMentions)
      .where(eq(tables.commentMentions.commentId, commentId));
    const removedMentionIds = currentMentions
      .filter((member) => !body.includes(`@${member.label}`))
      .map((member) => member.userId);
    if (removedMentionIds.length > 0) {
      await tx
        .delete(tables.commentMentions)
        .where(
          and(
            eq(tables.commentMentions.commentId, commentId),
            inArray(tables.commentMentions.userId, removedMentionIds),
          ),
        );
    }

    const [updated] = await tx
      .update(tables.comments)
      .set({ body, editedAt: new Date() })
      .where(eq(tables.comments.id, commentId))
      .returning();
    return ok(updated);
  });
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
