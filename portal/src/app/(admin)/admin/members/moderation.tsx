import { desc } from "drizzle-orm";
import { db, tables } from "@/db";
import { StatusBadge, Tag } from "@/components/ui";
import type { Viewer } from "@/lib/authz";
import { adminAccessError } from "@/lib/authz";
import { formatDate } from "../../format";
import { RemovePostForm } from "./remove-post-form";

// ADMIN-04 post moderation: recent posts across all types with an
// audit-logged removal action (reason required). Read is self-scoped to the
// already-guarded admin page; removal goes through the posts kernel.

export async function ModerationSection({ admin }: { admin: Viewer }) {
  if (adminAccessError(admin)) return null;

  const posts = await db.query.posts.findMany({
    orderBy: desc(tables.posts.createdAt),
    limit: 10,
  });
  const authors = await db.query.users.findMany({
    columns: { id: true, name: true },
  });
  const nameById = new Map(authors.map((a) => [a.id, a.name]));

  return (
    <section aria-labelledby="moderation-title" className="mt-6">
      <h3
        id="moderation-title"
        className="mb-2 text-sm font-semibold text-ink-secondary"
      >
        Post moderation
      </h3>
      <div className="flex flex-col gap-3">
        {posts.length === 0 ? (
          <p className="text-sm text-ink-muted">No posts yet.</p>
        ) : (
          posts.map((post) => (
            <div
              key={post.id}
              className="rounded-container border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Tag>{post.type}</Tag>
                <strong className="text-sm font-semibold text-ink">
                  {post.title}
                </strong>
                <StatusBadge
                  status={post.status === "removed" ? "rejected" : "approved"}
                >
                  {post.status}
                </StatusBadge>
              </div>
              <p className="mt-1 text-[13px] text-ink-secondary">
                {nameById.get(post.authorId) ?? "Unknown member"} ·{" "}
                {formatDate(post.createdAt)}
              </p>
              {post.status === "removed" ? (
                <p className="mt-2 text-[13px] text-ink-muted">
                  Removed: {post.removedReason ?? "no reason recorded"}
                </p>
              ) : (
                <RemovePostForm postId={post.id} />
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
