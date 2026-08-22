import type { NotificationRow } from "./queries";
import {
  enabledSectionsSentence,
  SECTION_LABELS,
} from "./section-labels";
import type { PostTypeName } from "@/lib/posts/types";

export type PresentedNotification = {
  kind: string;
  title: string;
  detail?: string;
  target?: string;
};

/** Shared, authorized notification copy for the header preview and archive. */
export function presentNotification(
  notification: NotificationRow,
): PresentedNotification {
  const payload = notification.payload;
  const postTitle =
    typeof payload.postTitle === "string" && payload.postTitle
      ? payload.postTitle
      : "a post";
  const postId = typeof payload.postId === "string" ? payload.postId : "";
  const commentId =
    typeof payload.commentId === "string" ? payload.commentId : "";
  const actor =
    typeof payload.actorName === "string" && payload.actorName
      ? payload.actorName
      : "A member";

  switch (notification.type) {
    case "tagged":
      return {
        kind: "Tagged for you",
        title: `You were tagged in "${postTitle}"`,
        target: postId ? `/posts/${postId}` : undefined,
      };
    case "comment":
      return {
        kind: "Comment",
        title: `${actor} commented on "${postTitle}"`,
        target: postId ? `/posts/${postId}` : undefined,
      };
    case "reply":
      return {
        kind: "Reply",
        title: `${actor} replied on "${postTitle}"`,
        target: postId ? `/posts/${postId}` : undefined,
      };
    case "mention":
      return {
        kind: "Mention",
        title: `${actor} mentioned you in a comment on "${postTitle}"`,
        target: postId
          ? `/posts/${postId}${commentId ? `#comment-${commentId}` : ""}`
          : undefined,
      };
    case "account_status": {
      const status =
        typeof payload.status === "string"
          ? payload.status.replace(/_/g, " ")
          : "updated";
      const detail =
        payload.status === "approved" &&
        Array.isArray(payload.enabledSections)
          ? enabledSectionsSentence(payload.enabledSections as string[])
          : typeof payload.reason === "string"
            ? payload.reason
            : undefined;
      return {
        kind: "Account",
        title: `Your account status changed to ${status}`,
        detail,
        target: "/me",
      };
    }
    case "application_submitted": {
      const name =
        typeof payload.applicantName === "string" && payload.applicantName
          ? payload.applicantName
          : "A member";
      const applicantId =
        typeof payload.applicantId === "string" ? payload.applicantId : "";
      const resubmitted = payload.resubmitted === true;
      return {
        kind: "Application",
        title: resubmitted
          ? `Updated application from ${name}`
          : `New application from ${name}`,
        target: applicantId ? `/admin/applications/${applicantId}` : undefined,
      };
    }
    case "account_sections": {
      const label =
        SECTION_LABELS[String(payload.section) as PostTypeName] ??
        String(payload.section);
      return {
        kind: "Account",
        title: `Posting access ${payload.enabled ? "enabled" : "disabled"}: ${label}`,
        target: "/me",
      };
    }
    default:
      return {
        kind: "Notification",
        title: "You have a new notification",
      };
  }
}
