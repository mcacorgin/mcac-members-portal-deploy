"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth";
import { removePost } from "@/lib/posts/mutations";

export type RemovePostState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function removePostAction(
  _prev: RemovePostState,
  formData: FormData,
): Promise<RemovePostState> {
  const postId = String(formData.get("postId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { status: "error", message: "A reason is required." };

  const viewer = await requireViewer();
  const result = await removePost(viewer, postId, reason);
  if (!result.ok) return { status: "error", message: result.message };

  revalidatePath("/admin/members");
  return { status: "idle" };
}
