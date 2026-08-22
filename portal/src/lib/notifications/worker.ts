import { and, asc, eq, isNull, lt } from "drizzle-orm";
import { db, tables } from "@/db";
import { sendMail } from "@/lib/mail";
import { hasAdminRole } from "@/lib/authz";
import {
  enabledSectionsSentence,
  SECTION_LABELS,
} from "@/lib/notifications/section-labels";
import type { PostTypeName } from "@/lib/posts/types";

// Outbox consumer (docs/build/events.md). Producers write in-app notification
// rows transactionally; this worker delivers the matching EMAILS (NOTF-02).
// At-least-once: a crash between sendMail and processedAt can resend an email,
// which is acceptable for this trigger set. Events failing 5 times are parked.

const MAX_ATTEMPTS = 5;

type OutboxRow = typeof tables.outboxEvents.$inferSelect;

export async function buildOutboxEmails(
  row: OutboxRow,
): Promise<{ to: string; subject: string; text: string }[]> {
  const p = row.payload as Record<string, unknown>;
  const base = process.env.AUTH_URL ?? "http://localhost:3000";

  const userEmail = async (id: string) => {
    const u = await db.query.users.findFirst({
      where: eq(tables.users.id, id),
      columns: { email: true, name: true, status: true, role: true },
    });
    return u ?? null;
  };

  switch (row.name) {
    case "account.approved": {
      const u = await userEmail(String(p.userId));
      if (!u) return [];
      const sections = Array.isArray(p.enabledSections)
        ? (p.enabledSections as string[])
        : [];
      const sectionLine = enabledSectionsSentence(sections);
      return [
        {
          to: u.email,
          subject: "Your MCAC membership is approved",
          text: `Hello ${u.name},\n\nYour MCAC application is approved. Sign in to enter the portal:\n${base}/home\n\n${sectionLine}\n`,
        },
      ];
    }
    case "account.needs_changes": {
      const u = await userEmail(String(p.userId));
      if (!u) return [];
      return [
        {
          to: u.email,
          subject: "Your MCAC application needs changes",
          text: `Hello ${u.name},\n\nAn administrator reviewed your application and requested changes:\n\n${String(p.reason ?? "")}\n\nSign in to update and resubmit:\n${base}/application/status\n`,
        },
      ];
    }
    case "account.rejected": {
      const u = await userEmail(String(p.userId));
      if (!u) return [];
      return [
        {
          to: u.email,
          subject: "Update on your MCAC application",
          text: `Hello ${u.name},\n\nYour MCAC portal application was not approved.\n\n${String(p.reason ?? "")}\n\nIf you believe this is an error, contact the MCAC office.\n`,
        },
      ];
    }
    case "post.tagged": {
      const ids = (p.taggedUserIds as string[]) ?? [];
      const mails = [];
      for (const id of ids) {
        const u = await userEmail(id);
        if (!u || u.status !== "approved") continue;
        mails.push({
          to: u.email,
          subject: `You were tagged: ${String(p.postTitle ?? "a new post")}`,
          text: `Hello ${u.name},\n\nA member tagged you as relevant to "${String(p.postTitle ?? "")}".\n\nView it here:\n${base}/posts/${String(p.postId)}\n`,
        });
      }
      return mails;
    }
    case "post.comment": {
      const postAuthor = p.postAuthorId ?? p.recipientId;
      const u = postAuthor ? await userEmail(String(postAuthor)) : null;
      if (!u || u.status !== "approved") return [];
      return [
        {
          to: u.email,
          subject: `New comment on: ${String(p.postTitle ?? "your post")}`,
          text: `Hello ${u.name},\n\nA member commented on "${String(p.postTitle ?? "")}".\n\nRead and reply:\n${base}/posts/${String(p.postId)}\n`,
        },
      ];
    }
    case "account.sections_changed": {
      const u = await userEmail(String(p.userId));
      if (!u || u.status !== "approved") return [];
      const label =
        SECTION_LABELS[String(p.section) as PostTypeName] ?? String(p.section);
      const verb = p.enabled ? "enabled" : "disabled";
      return [
        {
          to: u.email,
          subject: "Your MCAC posting access changed",
          text: `Hello ${u.name},\n\nAn admin ${verb} your posting access to the ${label} section.\n`,
        },
      ];
    }
    case "account.application_submitted": {
      // Recipient resolution: the transaction that emits this event fans out
      // one outbox row per approved admin (src/lib/account/registration.ts),
      // with that admin's id embedded in the payload as `adminId` - the same
      // per-recipient-emit shape as account.sections_changed - because the
      // set of approved admins can change over time and a single shared
      // event has no other way to tell this worker who it's for.
      const adminId = typeof p.adminId === "string" ? p.adminId : "";
      if (!adminId) return [];
      const u = await userEmail(adminId);
      // Re-check both role and status at send time: the recipient may have
      // been demoted or de-approved between the transaction that emitted
      // this event and delivery.
      if (!u || !hasAdminRole(u.role) || u.status !== "approved") return [];
      const name =
        typeof p.applicantName === "string" && p.applicantName
          ? p.applicantName
          : "A member";
      const applicantId = String(p.applicantId ?? "");
      const resubmitted = p.resubmitted === true;
      const subject = resubmitted
        ? `Updated application: ${name}`
        : `New MCAC application: ${name}`;
      const text = resubmitted
        ? `Hello ${u.name},\n\n${name} resubmitted their MCAC application with the requested changes.\n\nReview it here:\n${base}/admin/applications/${applicantId}\n`
        : `Hello ${u.name},\n\n${name} submitted a new MCAC application.\n\nReview it here:\n${base}/admin/applications/${applicantId}\n`;
      return [{ to: u.email, subject, text }];
    }
    case "comment.reply": {
      const u = p.parentAuthorId ? await userEmail(String(p.parentAuthorId)) : null;
      if (!u || u.status !== "approved") return [];
      return [
        {
          to: u.email,
          subject: `New reply on: ${String(p.postTitle ?? "a post")}`,
          text: `Hello ${u.name},\n\nA member replied to your comment on "${String(p.postTitle ?? "")}".\n\nRead and reply:\n${base}/posts/${String(p.postId)}\n`,
        },
      ];
    }
    case "comment.mentioned": {
      const ids = Array.isArray(p.mentionedUserIds)
        ? (p.mentionedUserIds as string[])
        : [];
      const mails = [];
      for (const id of ids) {
        const u = await userEmail(id);
        if (!u || u.status !== "approved") continue;
        mails.push({
          to: u.email,
          subject: `You were mentioned: ${String(p.postTitle ?? "a post")}`,
          text: `Hello ${u.name},\n\nA member mentioned you in a comment on "${String(p.postTitle ?? "")}".\n\nRead it here:\n${base}/posts/${String(p.postId)}#comment-${String(p.commentId)}\n`,
        });
      }
      return mails;
    }
    default:
      return [];
  }
}

export async function processOutbox(limit = 200): Promise<{ processed: number; failed: number }> {
  const pending = await db.query.outboxEvents.findMany({
    where: and(
      isNull(tables.outboxEvents.processedAt),
      lt(tables.outboxEvents.attempts, MAX_ATTEMPTS),
    ),
    orderBy: asc(tables.outboxEvents.id),
    limit,
  });

  let processed = 0;
  let failed = 0;
  for (const row of pending) {
    try {
      const mails = await buildOutboxEmails(row);
      for (const mail of mails) {
        const result = await sendMail(mail);
        if (!result.delivered) {
          throw new Error(`mail delivery failed for event ${row.id} (${row.name})`);
        }
      }
      await db
        .update(tables.outboxEvents)
        .set({ processedAt: new Date() })
        .where(eq(tables.outboxEvents.id, row.id));
      processed += 1;
    } catch (e) {
      console.error(`[outbox] event ${row.id} (${row.name}) failed`, e);
      await db
        .update(tables.outboxEvents)
        .set({ attempts: row.attempts + 1 })
        .where(eq(tables.outboxEvents.id, row.id));
      failed += 1;
    }
  }
  return { processed, failed };
}
