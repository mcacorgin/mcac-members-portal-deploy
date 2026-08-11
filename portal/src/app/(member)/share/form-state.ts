import type { ErrorCode } from "@/lib/contracts/result";

// Shared types between the SHARE-01 composer (client) and its server actions.

export type ShareFormState =
  | { status: "idle" }
  | {
      status: "error";
      code: ErrorCode;
      message: string;
      fieldErrors?: Record<string, string[]>;
    }
  | {
      // The post published but the optional attachment failed; the post link
      // is offered instead of retrying the whole draft (wireframe
      // attachment-error state adapted to the publish-then-attach flow).
      status: "attachment_failed";
      postId: string;
      message: string;
    };

export const SHARE_IDLE: ShareFormState = { status: "idle" };

export type MemberOption = {
  id: string;
  name: string;
  detail: string;
};
