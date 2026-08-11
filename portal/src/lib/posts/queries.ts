import { db, tables } from "@/db";
import { and, desc, eq, asc, inArray, count, or, ilike, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  enabledSections,
  hasAdminRole,
  memberAccessError,
  sectionEnabledFor,
  type Viewer,
} from "@/lib/authz";
import { ok, err, type ActionResult } from "@/lib/contracts/result";
import { escapeLike } from "@/lib/sql-text";
import { POST_TYPE_NAMES, type PostTypeName } from "./types";
import { OPPORTUNITY_MANDATE_TYPES, type OpportunityMandateType } from "./opportunity";

// Authorized reads for the posts kernel. Every function fails closed via
// memberAccessError and section gating (permission matrix `yes*` rows).

export type FeedView = "active" | "tagged" | "old" | "mine";

export type PostAuthor = {
  id: string;
  name: string;
  image: string | null;
};

export type FeedItem = {
  id: string;
  type: PostTypeName;
  title: string;
  body: string;
  status: "active" | "old" | "removed";
  metadata: Record<string, unknown>;
  createdAt: Date;
  expiresAt: Date | null;
  author: PostAuthor;
  commentCount: number;
  bookmarked: boolean;
  taggedViewer: boolean;
  lastEditedById: string | null;
  lastEditedAt: Date | null;
};

export type FeedPage = {
  items: FeedItem[];
  page: number;
  pageSize: number;
  total: number;
};

export type CommentNode = {
  id: string;
  // Null body/author when the comment is deleted; UI renders a placeholder.
  body: string | null;
  author: PostAuthor | null;
  deleted: boolean;
  createdAt: Date;
  replies: CommentNode[];
};

export type PostDetail = FeedItem & {
  // Only populated for admin viewers.
  removedReason: string | null;
  retentionExempt: boolean;
  taggedMembers: { id: string; name: string }[];
  attachments: {
    id: string;
    filename: string;
    mime: string;
    sizeBytes: number;
    purgedAt: Date | null;
  }[];
  comments: CommentNode[];
};

const DEFAULT_PAGE_SIZE = 20;

// Runtime-validated so an out-of-union view/type from a route handler fails
// closed instead of falling through without a status predicate.
const feedOptionsSchema = z.object({
  view: z.enum(["active", "tagged", "old", "mine"]),
  type: z.enum(POST_TYPE_NAMES).optional(),
  search: z.string().max(200).optional(),
  mandateType: z.enum(OPPORTUNITY_MANDATE_TYPES).optional(),
  industry: z.string().max(160).optional(),
  geography: z.string().max(160).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

function viewerFlags(viewerId: string) {
  return {
    commentCount: sql<number>`(select count(*)::int from ${tables.comments} where ${tables.comments.postId} = ${tables.posts.id} and ${tables.comments.deletedAt} is null)`,
    bookmarked: sql<boolean>`exists (select 1 from ${tables.bookmarks} where ${tables.bookmarks.postId} = ${tables.posts.id} and ${tables.bookmarks.userId} = ${viewerId})`,
    taggedViewer: sql<boolean>`exists (select 1 from ${tables.postTaggedMembers} where ${tables.postTaggedMembers.postId} = ${tables.posts.id} and ${tables.postTaggedMembers.userId} = ${viewerId})`,
  };
}

export async function listFeed(
  viewer: Viewer | null,
  opts: {
    view: FeedView;
    type?: PostTypeName;
    search?: string;
    mandateType?: OpportunityMandateType;
    industry?: string;
    geography?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<ActionResult<FeedPage>> {
  const accessErr = memberAccessError(viewer);
  if (accessErr) return err(accessErr, "You cannot view member posts.");
  const v = viewer!;

  const parsedOpts = feedOptionsSchema.safeParse(opts);
  if (!parsedOpts.success) {
    return err("validation", "Invalid feed options.");
  }
  const {
    view,
    type,
    search: rawSearch,
    mandateType,
    industry: rawIndustry,
    geography: rawGeography,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  } =
    parsedOpts.data;

  const conds: SQL[] = [];
  if (type) {
    if (!(await sectionEnabledFor(type, v.id))) {
      return err("section_disabled", "This section is not available.");
    }
    conds.push(eq(tables.posts.type, type));
  } else {
    const enabled = await enabledSections(v.id);
    if (enabled.length === 0) return ok({ items: [], page, pageSize, total: 0 });
    if (enabled.length < POST_TYPE_NAMES.length) {
      conds.push(inArray(tables.posts.type, enabled));
    }
  }

  const isAdmin = hasAdminRole(v.role);
  switch (view) {
    case "active":
      conds.push(eq(tables.posts.status, "active"));
      break;
    case "old":
      conds.push(eq(tables.posts.status, "old"));
      break;
    case "tagged":
      conds.push(
        sql`exists (select 1 from ${tables.postTaggedMembers} where ${tables.postTaggedMembers.postId} = ${tables.posts.id} and ${tables.postTaggedMembers.userId} = ${v.id})`,
      );
      if (!isAdmin) conds.push(sql`${tables.posts.status} <> 'removed'`);
      break;
    case "mine":
      conds.push(eq(tables.posts.authorId, v.id));
      if (!isAdmin) conds.push(sql`${tables.posts.status} <> 'removed'`);
      break;
  }

  const search = rawSearch?.trim();
  if (search) {
    const pattern = `%${escapeLike(search)}%`;
    conds.push(
      or(ilike(tables.posts.title, pattern), ilike(tables.posts.body, pattern))!,
    );
  }

  // Mandate metadata is additive JSONB data. The feed keeps generic legacy
  // opportunities visible unless the member explicitly applies a mandate
  // filter, in which case only structured opportunity posts can match.
  if (mandateType || rawIndustry?.trim() || rawGeography?.trim()) {
    conds.push(eq(tables.posts.type, "opportunity"));
  }
  if (mandateType) {
    conds.push(sql`${tables.posts.metadata} ->> 'mandateType' = ${mandateType}`);
  }
  const industry = rawIndustry?.trim();
  if (industry) {
    conds.push(
      ilike(sql<string>`${tables.posts.metadata} ->> 'industry'`, `%${escapeLike(industry)}%`),
    );
  }
  const geography = rawGeography?.trim();
  if (geography) {
    conds.push(
      ilike(sql<string>`${tables.posts.metadata} ->> 'geography'`, `%${escapeLike(geography)}%`),
    );
  }

  const where = and(...conds);
  const [[{ total }], rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(tables.posts)
      .where(where),
    db
      .select({
      id: tables.posts.id,
      type: tables.posts.type,
      title: tables.posts.title,
      body: tables.posts.body,
      status: tables.posts.status,
      metadata: tables.posts.metadata,
      createdAt: tables.posts.createdAt,
      expiresAt: tables.posts.expiresAt,
      lastEditedById: tables.posts.lastEditedById,
      lastEditedAt: tables.posts.lastEditedAt,
      authorId: tables.users.id,
      authorName: tables.users.name,
      authorImage: tables.users.image,
      ...viewerFlags(v.id),
      })
      .from(tables.posts)
      .innerJoin(tables.users, eq(tables.posts.authorId, tables.users.id))
      .where(where)
      .orderBy(desc(tables.posts.createdAt), desc(tables.posts.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  return ok({
    items: rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      status: r.status,
      metadata: r.metadata as Record<string, unknown>,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      author: { id: r.authorId, name: r.authorName, image: r.authorImage },
      commentCount: r.commentCount,
      bookmarked: r.bookmarked,
      taggedViewer: r.taggedViewer,
      lastEditedById: r.lastEditedById,
      lastEditedAt: r.lastEditedAt,
    })),
    page,
    pageSize,
    total,
  });
}

export async function getPostDetail(
  viewer: Viewer | null,
  postId: string,
): Promise<ActionResult<PostDetail>> {
  const accessErr = memberAccessError(viewer);
  if (accessErr) return err(accessErr, "You cannot view member posts.");
  const v = viewer!;
  const isAdmin = hasAdminRole(v.role);

  const [row] = await db
    .select({
      id: tables.posts.id,
      type: tables.posts.type,
      title: tables.posts.title,
      body: tables.posts.body,
      status: tables.posts.status,
      metadata: tables.posts.metadata,
      createdAt: tables.posts.createdAt,
      expiresAt: tables.posts.expiresAt,
      removedReason: tables.posts.removedReason,
      retentionExempt: tables.posts.retentionExempt,
      lastEditedById: tables.posts.lastEditedById,
      lastEditedAt: tables.posts.lastEditedAt,
      authorId: tables.users.id,
      authorName: tables.users.name,
      authorImage: tables.users.image,
      ...viewerFlags(v.id),
    })
    .from(tables.posts)
    .innerJoin(tables.users, eq(tables.posts.authorId, tables.users.id))
    .where(eq(tables.posts.id, postId))
    .limit(1);

  if (!row) return err("not_found", "Post not found.");
  if (row.status === "removed" && !isAdmin) {
    return err("not_found", "Post not found.");
  }
  if (!(await sectionEnabledFor(row.type, v.id))) {
    return err("section_disabled", "This section is not available.");
  }

  const [taggedMembers, attachmentRows, commentRows] = await Promise.all([
    db
      .select({ id: tables.users.id, name: tables.users.name })
      .from(tables.postTaggedMembers)
      .innerJoin(
        tables.users,
        eq(tables.postTaggedMembers.userId, tables.users.id),
      )
      .where(eq(tables.postTaggedMembers.postId, postId)),
    db
      .select({
        id: tables.attachments.id,
        filename: tables.attachments.filename,
        mime: tables.attachments.mime,
        sizeBytes: tables.attachments.sizeBytes,
        purgedAt: tables.attachments.purgedAt,
      })
      .from(tables.attachments)
      .where(eq(tables.attachments.postId, postId))
      .orderBy(asc(tables.attachments.createdAt)),
    db
      .select({
        id: tables.comments.id,
        parentId: tables.comments.parentId,
        body: tables.comments.body,
        createdAt: tables.comments.createdAt,
        deletedAt: tables.comments.deletedAt,
        authorId: tables.users.id,
        authorName: tables.users.name,
        authorImage: tables.users.image,
      })
      .from(tables.comments)
      .innerJoin(tables.users, eq(tables.comments.authorId, tables.users.id))
      .where(eq(tables.comments.postId, postId))
      .orderBy(asc(tables.comments.createdAt), asc(tables.comments.id)),
  ]);

  const toNode = (c: (typeof commentRows)[number]): CommentNode => ({
    id: c.id,
    body: c.deletedAt ? null : c.body,
    author: c.deletedAt
      ? null
      : { id: c.authorId, name: c.authorName, image: c.authorImage },
    deleted: c.deletedAt !== null,
    createdAt: c.createdAt,
    replies: [],
  });
  const topLevel = new Map<string, CommentNode>();
  for (const c of commentRows) {
    if (!c.parentId) topLevel.set(c.id, toNode(c));
  }
  for (const c of commentRows) {
    if (c.parentId) topLevel.get(c.parentId)?.replies.push(toNode(c));
  }

  return ok({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    status: row.status,
    metadata: row.metadata as Record<string, unknown>,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    removedReason: isAdmin ? row.removedReason : null,
    retentionExempt: row.retentionExempt,
    author: { id: row.authorId, name: row.authorName, image: row.authorImage },
    commentCount: row.commentCount,
    bookmarked: row.bookmarked,
    taggedViewer: row.taggedViewer,
    lastEditedById: row.lastEditedById,
    lastEditedAt: row.lastEditedAt,
    taggedMembers,
    attachments: attachmentRows,
    comments: [...topLevel.values()],
  });
}

export async function listSaved(
  viewer: Viewer | null,
): Promise<ActionResult<FeedItem[]>> {
  const accessErr = memberAccessError(viewer);
  if (accessErr) return err(accessErr, "You cannot view member posts.");
  const v = viewer!;

  const enabled = await enabledSections(v.id);
  if (enabled.length === 0) return ok([]);

  const conds: SQL[] = [eq(tables.bookmarks.userId, v.id)];
  if (enabled.length < POST_TYPE_NAMES.length) {
    conds.push(inArray(tables.posts.type, enabled));
  }
  if (!hasAdminRole(v.role)) {
    conds.push(sql`${tables.posts.status} <> 'removed'`);
  }

  const rows = await db
    .select({
      id: tables.posts.id,
      type: tables.posts.type,
      title: tables.posts.title,
      body: tables.posts.body,
      status: tables.posts.status,
      metadata: tables.posts.metadata,
      createdAt: tables.posts.createdAt,
      expiresAt: tables.posts.expiresAt,
      lastEditedById: tables.posts.lastEditedById,
      lastEditedAt: tables.posts.lastEditedAt,
      authorId: tables.users.id,
      authorName: tables.users.name,
      authorImage: tables.users.image,
      ...viewerFlags(v.id),
    })
    .from(tables.bookmarks)
    .innerJoin(tables.posts, eq(tables.bookmarks.postId, tables.posts.id))
    .innerJoin(tables.users, eq(tables.posts.authorId, tables.users.id))
    .where(and(...conds))
    .orderBy(desc(tables.bookmarks.createdAt));

  return ok(
    rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      status: r.status,
      metadata: r.metadata as Record<string, unknown>,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      author: { id: r.authorId, name: r.authorName, image: r.authorImage },
      commentCount: r.commentCount,
      bookmarked: r.bookmarked,
      taggedViewer: r.taggedViewer,
      lastEditedById: r.lastEditedById,
      lastEditedAt: r.lastEditedAt,
    })),
  );
}
