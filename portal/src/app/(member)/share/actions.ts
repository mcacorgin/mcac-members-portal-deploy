"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { memberAccessError } from "@/lib/authz";
import { createPost } from "@/lib/posts/mutations";
import { POST_TYPE_NAMES, type PostTypeName } from "@/lib/posts/types";
import {
  ALLOWED_ATTACHMENT_MIMES,
  MAX_ATTACHMENT_BYTES,
  saveAttachment,
} from "@/lib/attachments";
import { searchMembers } from "@/lib/directory/queries";
import { ok, err, type ActionResult } from "@/lib/contracts/result";
import type { MemberOption, ShareFormState } from "./form-state";

// SHARE-01 server actions. The posts kernel re-authorizes everything; this
// file adapts FormData to CreatePostInput and runs the publish-then-attach
// flow (createPost first, saveAttachment second, then redirect).

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function buildMetadata(
  type: PostTypeName,
  formData: FormData,
): { metadata: Record<string, unknown> } | { error: ShareFormState } {
  switch (type) {
    case "opportunity":
      return {
        metadata: {
          industry: text(formData, "industry"),
          requestedAction: text(formData, "requestedAction"),
        },
      };
    case "job": {
      const industry = text(formData, "industry");
      return {
        metadata: {
          location: text(formData, "location"),
          ...(industry ? { industry } : {}),
        },
      };
    }
    case "knowledge": {
      const category = text(formData, "category");
      return { metadata: category ? { category } : {} };
    }
    case "event": {
      const raw = text(formData, "startsAt");
      const parsed = raw ? new Date(raw) : null;
      if (!parsed || Number.isNaN(parsed.getTime())) {
        return {
          error: {
            status: "error",
            code: "validation",
            message: "Check the highlighted fields.",
            fieldErrors: {
              "metadata.startsAt": ["Enter the event date and time."],
            },
          },
        };
      }
      return {
        metadata: {
          startsAt: parsed.toISOString(),
          location: text(formData, "location"),
          mode: text(formData, "mode"),
        },
      };
    }
  }
}

export async function publishShareAction(
  _prev: ShareFormState,
  formData: FormData,
): Promise<ShareFormState> {
  const viewer = await requireViewer();
  const denied = memberAccessError(viewer);
  if (denied) {
    return {
      status: "error",
      code: denied,
      message: "You cannot publish posts.",
    };
  }

  const typeRaw = text(formData, "type");
  if (!POST_TYPE_NAMES.includes(typeRaw as PostTypeName)) {
    return {
      status: "error",
      code: "validation",
      message: "Choose what you are sharing first.",
      fieldErrors: { type: ["Choose a post type."] },
    };
  }
  const type = typeRaw as PostTypeName;

  const built = buildMetadata(type, formData);
  if ("error" in built) return built.error;

  // Validate the optional attachment BEFORE publishing so an invalid file
  // fails the whole submit while the draft is still intact.
  const file = formData.get("attachment");
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return {
        status: "error",
        code: "validation",
        message: "Check the highlighted fields.",
        fieldErrors: { attachment: ["Attachments are limited to 10 MB."] },
      };
    }
    if (
      !(ALLOWED_ATTACHMENT_MIMES as readonly string[]).includes(file.type)
    ) {
      return {
        status: "error",
        code: "validation",
        message: "Check the highlighted fields.",
        fieldErrors: {
          attachment: [
            "Use an accepted file type: PDF, PNG, JPEG, WebP, XLSX, or DOCX.",
          ],
        },
      };
    }
  }

  const taggedUserIds = formData
    .getAll("taggedUserIds")
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .slice(0, 20);

  const created = await createPost(viewer, {
    type,
    title: text(formData, "title"),
    body: text(formData, "body"),
    metadata: built.metadata,
    taggedUserIds,
  });
  if (!created.ok) {
    return {
      status: "error",
      code: created.code,
      message: created.message,
      fieldErrors: created.fieldErrors,
    };
  }
  const post = created.data;

  if (hasFile) {
    let attached = false;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await saveAttachment(viewer, {
        postId: post.id,
        filename: file.name || "attachment",
        mime: file.type as (typeof ALLOWED_ATTACHMENT_MIMES)[number],
        sizeBytes: file.size,
        bytes,
      });
      attached = result.ok;
    } catch {
      attached = false;
    }
    if (!attached) {
      revalidatePath("/home");
      return {
        status: "attachment_failed",
        postId: post.id,
        message:
          "Your post was published, but the attachment could not be uploaded. Open the post to try again later.",
      };
    }
  }

  revalidatePath("/home");
  redirect(`/posts/${post.id}`);
}

export async function searchMembersAction(
  q: string,
): Promise<ActionResult<MemberOption[]>> {
  const viewer = await requireViewer();
  const term = q.trim();
  if (!term) return ok([]);

  const result = await searchMembers(viewer, { q: term, pageSize: 8 });
  if (!result.ok) return err(result.code, result.message);

  return ok(
    result.data.rows
      .filter((row) => row.id !== viewer!.id)
      .map((row) => ({
        id: row.id,
        name: row.name,
        detail: [row.city, row.company].filter(Boolean).join(" · "),
      })),
  );
}
