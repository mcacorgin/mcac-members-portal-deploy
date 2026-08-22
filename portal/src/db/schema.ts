import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  bigserial,
  boolean,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums (frozen contract: docs/build/state-machines.md, permission-matrix.md)
// ---------------------------------------------------------------------------

export const userRole = pgEnum("user_role", ["member", "admin", "superadmin"]);

// An "applicant" is a user whose accountStatus is pending / rejected /
// needs_changes. Approved members and admins are accountStatus=approved.
export const accountStatus = pgEnum("account_status", [
  "pending",
  "approved",
  "rejected",
  "needs_changes",
  "suspended",
]);

export const fieldVisibility = pgEnum("field_visibility", [
  "visible", // visible to approved members
  "hidden",
  "admin_only",
]);

export const postType = pgEnum("post_type", [
  "opportunity",
  "job",
  "knowledge",
  "event",
]);

export const postStatus = pgEnum("post_status", ["active", "old", "removed"]);

// UTC-naive default for every `timestamp` (no timezone) column. Bare now()
// writes the DB server's LOCAL wall clock, but drizzle reads naive columns as
// UTC (and serializes JS Dates with toISOString), so on any non-UTC host the
// two paths disagree by the UTC offset — an app-created post showed "7h ago"
// immediately on a UTC-7 machine. Project rule: DB-side clocks on naive
// columns always go through timezone('utc', now()).
const utcNow = sql`timezone('utc', now())`;

const uuidPk = () =>
  text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`);

// ---------------------------------------------------------------------------
// Identity & lifecycle
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuidPk(),
    name: text("name").notNull().default(""),
    email: text("email").notNull(),
    emailVerified: timestamp("email_verified", { mode: "date" }),
    image: text("image"),
    passwordHash: text("password_hash"),
    role: userRole("role").notNull().default("member"),
    status: accountStatus("status").notNull().default("pending"),
    // Reviewer-facing reason for rejected / needs_changes / suspended.
    statusReason: text("status_reason"),
    statusChangedAt: timestamp("status_changed_at", { mode: "date" }),
    // Set on password reset; JWTs issued before this instant are rejected,
    // so a stolen session dies when the owner resets credentials.
    credentialsChangedAt: timestamp("credentials_changed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().default(utcNow),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

// Auth.js adapter tables (OAuth account links; sessions unused under JWT
// strategy but kept for adapter compatibility).
export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    // One LinkedIn identity per member. Hiding a button is not enforcement;
    // server actions stay callable, so the database holds the line.
    uniqueIndex("accounts_user_provider_idx").on(t.userId, t.provider),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

/**
 * Proof that a member re-entered their password moments before starting the
 * LinkedIn OAuth round trip. The raw token lives in a short-lived httpOnly
 * cookie; only its hash is stored, so a database read yields nothing usable.
 * Single use - consumed and deleted in the signIn callback.
 */
export const linkIntents = pgTable("link_intents", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().default(utcNow),
  // This is an absolute security boundary, not a local wall-clock value.
  expiresAt: timestamp("expires_at", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
});

/** Shared authentication failure windows for all application instances. */
export const authRateLimits = pgTable("auth_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  city: text("city").notNull().default(""),
  phone: text("phone").notNull().default(""),
  company: text("company").notNull().default(""),
  title: text("title").notNull().default(""),
  bio: text("bio").notNull().default(""),
  linkedinUrl: text("linkedin_url").notNull().default(""),
  phoneVisibility: fieldVisibility("phone_visibility")
    .notNull()
    .default("hidden"),
  emailVisibility: fieldVisibility("email_visibility")
    .notNull()
    .default("admin_only"),
  linkedinVisibility: fieldVisibility("linkedin_visibility")
    .notNull()
    .default("visible"),
  // AUTH-03: set when the member explicitly records per-field visibility
  // choices; the flow does not proceed past contact-visibility until then.
  contactChoicesAt: timestamp("contact_choices_at", { mode: "date" }),
  // AUTH-02: the optional communications consent offered by the privacy
  // notice of 2026-08-15. Independent of the mandatory processing consent -
  // registration never depends on it - and withdrawable from /me/edit, which
  // is what makes section 10 of the notice ("a mechanism ... comparable to
  // the mechanism through which consent was provided") true.
  communicationsOptIn: boolean("communications_opt_in")
    .notNull()
    .default(false),
  // Set on every recorded decision, opt-in or withdrawal, so a `false` that
  // was chosen is distinguishable from a `false` nobody ever answered. The
  // decision history itself lives in audit_log.
  communicationsDecidedAt: timestamp("communications_decided_at", {
    mode: "date",
  }),
  // Historical directory-choice fields retained for audit and rollback after
  // Sandeep retired the member-facing opt-out on 2026-08-20. Runtime directory,
  // profile, and tagging queries must not use these fields as eligibility gates.
  directoryListed: boolean("directory_listed").notNull().default(false),
  directoryDecidedAt: timestamp("directory_decided_at", { mode: "date" }),
  // Set when the applicant submits their application evidence (pre-approval since 2026-07-30). Column keeps its historical name; rename deferred until a coherent migration window.
  onboardingCompletedAt: timestamp("onboarding_completed_at", { mode: "date" }),
});

export const expertiseTags = pgTable(
  "expertise_tags",
  {
    id: uuidPk(),
    label: text("label").notNull(),
  },
  (t) => [uniqueIndex("expertise_tags_label_idx").on(t.label)],
);

export const memberTags = pgTable(
  "member_tags",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => expertiseTags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.tagId] })],
);

// ---------------------------------------------------------------------------
// Privacy consent (AUTH-03/04): versioned notices, insert-only acceptance log
// ---------------------------------------------------------------------------

export const privacyNotices = pgTable(
  "privacy_notices",
  {
    id: uuidPk(),
    version: integer("version").notNull(),
    body: text("body").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    publishedAt: timestamp("published_at", { mode: "date" })
      .notNull()
      .default(utcNow),
  },
  (t) => [uniqueIndex("privacy_notices_version_idx").on(t.version)],
);

export const consentRecords = pgTable(
  "consent_records",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    noticeVersion: integer("notice_version").notNull(),
    acceptedAt: timestamp("accepted_at", { mode: "date" })
      .notNull()
      .default(utcNow),
  },
  (t) => [index("consent_records_user_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Posts kernel (opportunity / job / knowledge / event share one engine)
// ---------------------------------------------------------------------------

export const posts = pgTable(
  "posts",
  {
    id: uuidPk(),
    type: postType("type").notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    // Type-specific validated metadata (industry, requestedAction, event
    // dates/location, ...) per the post-type capability schema.
    metadata: jsonb("metadata").notNull().default({}),
    status: postStatus("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    retentionExempt: boolean("retention_exempt").notNull().default(false),
    removedReason: text("removed_reason"),
    lastEditedById: text("last_edited_by_id").references(() => users.id),
    lastEditedAt: timestamp("last_edited_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().default(utcNow),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().default(utcNow),
  },
  (t) => [
    index("posts_type_status_idx").on(t.type, t.status, t.createdAt),
    index("posts_author_idx").on(t.authorId),
  ],
);

export const postTaggedMembers = pgTable(
  "post_tagged_members",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.userId] }),
    index("post_tagged_members_user_idx").on(t.userId),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: uuidPk(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    parentId: text("parent_id").references((): AnyPgColumn => comments.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().default(utcNow),
    editedAt: timestamp("edited_at", { mode: "date" }),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
  },
  (t) => [index("comments_post_idx").on(t.postId, t.createdAt)],
);

// Structured comment mentions keep identity separate from display text. The
// comment body remains plain text; this relation is the authorization and
// notification source of truth.
export const commentMentions = pgTable(
  "comment_mentions",
  {
    commentId: text("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Snapshot the inserted token so later member-name changes do not break
    // rendering or edit-time mention cleanup for historical comments.
    label: text("label").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.commentId, t.userId] }),
    index("comment_mentions_user_idx").on(t.userId),
  ],
);

export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().default(utcNow),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] })],
);

// FILE-01: object keys are random, never public; downloads authorize first.
export const attachments = pgTable(
  "attachments",
  {
    id: uuidPk(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    uploaderId: text("uploader_id")
      .notNull()
      .references(() => users.id),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    objectKey: text("object_key").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().default(utcNow),
    purgedAt: timestamp("purged_at", { mode: "date" }),
  },
  (t) => [
    uniqueIndex("attachments_object_key_idx").on(t.objectKey),
    index("attachments_post_idx").on(t.postId),
  ],
);

// ---------------------------------------------------------------------------
// Notifications (NOTF-01/02) via transactional outbox
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  "notifications",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    readAt: timestamp("read_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().default(utcNow),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: text("name").notNull(),
    payload: jsonb("payload").notNull().default({}),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().default(utcNow),
    processedAt: timestamp("processed_at", { mode: "date" }),
  },
  (t) => [index("outbox_events_pending_idx").on(t.processedAt, t.id)],
);

// ---------------------------------------------------------------------------
// Configuration, section toggles, audit
// ---------------------------------------------------------------------------

export const appConfig = pgTable("app_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().default(utcNow),
  updatedBy: text("updated_by"),
});

export const memberSectionOverrides = pgTable(
  "member_section_overrides",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    section: postType("section").notNull(),
    enabled: boolean("enabled").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.section] })],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: text("actor_id").references(() => users.id),
    action: text("action").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    detail: jsonb("detail").notNull().default({}),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().default(utcNow),
  },
  (t) => [index("audit_log_subject_idx").on(t.subjectType, t.subjectId)],
);
