"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth";
import {
  addComment,
  deleteOwnComment,
  removePost,
  setPostRetentionExempt,
  toggleBookmark,
  updatePost,
} from "@/lib/posts/mutations";
import { ok, err, type ActionResult } from "@/lib/contracts/result";

// Server actions for HOME-01/HOME-02 interactions. Each re-authorizes via the
// posts kernel (defense in depth); this file only adapts inputs and
// revalidates the affected routes.

function revalidatePost(postId: string) {
  revalidatePath("/home");
  revalidatePath(`/posts/${postId}`);
  // Unsaving from the Saved screen must not leave a stale card behind.
  revalidatePath("/saved");
}

export async function toggleBookmarkAction(
  postId: string,
): Promise<ActionResult<{ bookmarked: boolean }>> {
  const viewer = await requireViewer();
  const result = await toggleBookmark(viewer, postId);
  if (result.ok) revalidatePost(postId);
  return result;
}

export async function addCommentAction(input: {
  postId: string;
  body: string;
  parentId?: string;
}): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireViewer();
  const result = await addComment(viewer, input);
  if (!result.ok) {
    return err(result.code, result.message, result.fieldErrors);
  }
  revalidatePost(input.postId);
  return ok({ id: result.data.id });
}

export async function deleteOwnCommentAction(
  commentId: string,
  postId: string,
): Promise<ActionResult<void>> {
  const viewer = await requireViewer();
  const result = await deleteOwnComment(viewer, commentId);
  if (result.ok) revalidatePost(postId);
  return result;
}

export async function editPostAction(input: {
  postId: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
}): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireViewer();
  const result = await updatePost(viewer, input);
  if (!result.ok) return err(result.code, result.message, result.fieldErrors);
  revalidatePost(input.postId);
  return ok({ id: result.data.id });
}

export async function removePostAction(
  postId: string,
  reason: string,
): Promise<ActionResult<void>> {
  const viewer = await requireViewer();
  const result = await removePost(viewer, postId, reason);
  if (result.ok) revalidatePost(postId);
  return result;
}

export async function setPostRetentionExemptAction(
  postId: string,
  exempt: boolean,
): Promise<ActionResult<void>> {
  const viewer = await requireViewer();
  const result = await setPostRetentionExempt(viewer, postId, exempt);
  if (result.ok) revalidatePost(postId);
  return result;
}
