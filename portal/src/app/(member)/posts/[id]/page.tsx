import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { hasAdminRole, memberAccessError } from "@/lib/authz";
import { resolveLandingPath } from "@/lib/account/routing";
import { getPostDetail } from "@/lib/posts/queries";
import {
  TYPE_CONFIG,
  type PostTypeName,
} from "@/lib/posts/types";
import {
  MANDATE_BASIS_LABELS,
  MANDATE_TYPE_LABELS,
  MATERIAL_LABELS,
  OPPORTUNITY_ROLE_LABELS,
  TRANSACTION_STRUCTURE_LABELS,
  isMandateOpportunityMetadata,
  type OpportunityMandateType,
  type OpportunityRole,
} from "@/lib/posts/opportunity";
import {
  Avatar,
  Button,
  Card,
  ErrorState,
  ScreenId,
  StatusBadge,
  Tag,
} from "@/components/ui";
import {
  EVENT_MODE_LABELS,
  TYPE_LABELS,
  daysLeft,
  editedNote,
  formatBytes,
  formatDate,
  formatDateTime,
  relativeTime,
} from "../display";
import { formatMandateAmount } from "../display";
import { BookmarkButton } from "../bookmark-button";
import { CommentsSection } from "./comments";
import { AdminRemoveControl } from "./admin-remove";
import { AdminRetentionControl } from "./admin-retention-control";
import { EditPostForm } from "./edit-post-form";

// HOME-02 - full post detail with metadata, tagged members, attachments,
// bookmark, discussion thread, and the admin-only removal control.

function metadataRows(
  type: PostTypeName,
  metadata: Record<string, unknown>,
): { label: string; value: string }[] {
  const str = (key: string): string | null => {
    const v = metadata[key];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const rows: { label: string; value: string | null }[] = [];
  const num = (key: string): number | null => {
    const value = metadata[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  const selectedLabels = (key: string, source: Record<string, string>) => {
    const value = metadata[key];
    if (!Array.isArray(value)) return null;
    const resolved = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => source[item] ?? item);
    return resolved.length > 0 ? resolved.join(", ") : null;
  };
  switch (type) {
    case "opportunity":
      if (isMandateOpportunityMetadata(metadata)) {
        const mandateType = str("mandateType") as OpportunityMandateType;
        const basis = str("mandateBasis");
        rows.push({ label: "Opportunity type", value: MANDATE_TYPE_LABELS[mandateType] });
        rows.push({ label: "Industry", value: str("industry") });
        rows.push({ label: "Specialisation", value: str("specialization") });
        rows.push({ label: "Geography", value: str("geography") });
        rows.push({
          label: "Mandate basis",
          value: basis
            ? (MANDATE_BASIS_LABELS[
                basis as keyof typeof MANDATE_BASIS_LABELS
              ] ?? basis)
            : null,
        });
        rows.push({ label: "Mandate start", value: str("mandateStartDate") });
        rows.push({ label: "Materials available", value: selectedLabels("materialsAvailable", MATERIAL_LABELS) });
        rows.push({ label: "Transaction structure", value: selectedLabels("transactionStructures", TRANSACTION_STRUCTURE_LABELS) });
        rows.push({ label: mandateType === "sell_side" ? "Asking range" : "Budget range", value: formatMandateAmount(metadata) });
        if (mandateType === "sell_side") {
          rows.push({ label: "Business location", value: str("businessLocation") });
          const stake = num("stakePercent");
          rows.push({ label: "Stake available", value: stake === null ? null : `${stake}%` });
          rows.push({ label: "Revenue", value: num("revenue")?.toLocaleString() ?? null });
          rows.push({ label: "EBITDA", value: num("ebitda")?.toLocaleString() ?? null });
        } else {
          rows.push({ label: "Target requirement", value: str("targetCriteria") });
          rows.push({ label: "Distressed opportunities", value: metadata.distressedAllowed === true ? "Open" : null });
        }
        {
          const role = str("roleInOpportunity") as OpportunityRole | null;
          rows.push({
            label: "Role in opportunity",
            value: role ? (OPPORTUNITY_ROLE_LABELS[role] ?? role) : null,
          });
        }
        rows.push({ label: "Action needed", value: str("requestedAction") });
        break;
      }
      rows.push({ label: "Industry", value: str("industry") });
      {
        const role = str("roleInOpportunity") as OpportunityRole | null;
        rows.push({
          label: "Role in opportunity",
          value: role ? (OPPORTUNITY_ROLE_LABELS[role] ?? role) : null,
        });
      }
      rows.push({ label: "Action needed", value: str("requestedAction") });
      break;
    case "job":
      rows.push({ label: "Location", value: str("location") });
      rows.push({ label: "Industry", value: str("industry") });
      break;
    case "knowledge":
      rows.push({ label: "Category", value: str("category") });
      break;
    case "event": {
      const startsAt = str("startsAt");
      rows.push({
        label: "Date",
        value: startsAt ? formatDateTime(startsAt) : null,
      });
      rows.push({ label: "Location", value: str("location") });
      const mode = str("mode");
      rows.push({
        label: "Mode",
        value: mode ? (EVENT_MODE_LABELS[mode] ?? mode) : null,
      });
      break;
    }
  }
  return rows.filter((r): r is { label: string; value: string } =>
    Boolean(r.value),
  );
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireViewer();
  const denied = memberAccessError(viewer);
  if (denied) redirect(await resolveLandingPath(viewer));
  const { id } = await params;

  const result = await getPostDetail(viewer, id);

  if (!result.ok) {
    if (result.code === "not_found") notFound();
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Button href="/home" variant="ghost">
            Back to Home
          </Button>
          <ScreenId id="HOME-02" />
        </div>
        {result.code === "section_disabled" ? (
          <ErrorState
            title="This section is not available"
            body="An administrator has disabled this post type for your account. Other posts remain available."
            action={
              <Button href="/home" variant="secondary">
                Back to Home
              </Button>
            }
          />
        ) : (
          <ErrorState
            title="This post could not load"
            body="Try again in a moment."
            action={
              <Button href={`/posts/${id}`} variant="secondary">
                Retry
              </Button>
            }
          />
        )}
      </div>
    );
  }

  const post = result.data;
  const isAdmin = hasAdminRole(viewer!.role);
  const rows = metadataRows(post.type, post.metadata);
  const structuredMandate =
    post.type === "opportunity" && isMandateOpportunityMetadata(post.metadata);
  const remaining =
    post.status === "active" && post.type === "opportunity"
      ? daysLeft(post.expiresAt)
      : null;
  const capabilities = TYPE_CONFIG[post.type].capabilities;
  const canEdit = viewer!.id === post.author.id || isAdmin;
  const note = editedNote(post);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Button href="/home" variant="ghost">
          Back to Home
        </Button>
        <ScreenId id="HOME-02" />
      </div>

      <article className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tag>{TYPE_LABELS[post.type]}</Tag>
          {post.taggedViewer ? (
            <StatusBadge status="pending">Tagged for you</StatusBadge>
          ) : null}
          {post.status === "old" ? (
            <StatusBadge status="old">
              {post.expiresAt
                ? `Old · expired ${formatDate(post.expiresAt)}`
                : "Old"}
            </StatusBadge>
          ) : null}
          {post.status === "removed" ? (
            <StatusBadge status="rejected">Removed</StatusBadge>
          ) : null}
          {remaining !== null ? (
            <span className="text-xs text-ink-muted">{remaining}d left</span>
          ) : null}
        </div>

        <h1 className="text-[22px] font-semibold text-balance text-ink">
          {post.title}
        </h1>

        <div className="flex items-center gap-2.5 text-sm text-ink-secondary">
          <Avatar
            name={post.author.name}
            src={post.author.image ?? undefined}
          />
          <div>
            <p className="font-medium text-ink">{post.author.name}</p>
            <p className="text-ink-muted" suppressHydrationWarning>
              {relativeTime(post.createdAt)}
              {note ? ` · ${note}` : ""}
            </p>
          </div>
          <BookmarkButton
            postId={post.id}
            bookmarked={post.bookmarked}
            className="ml-auto"
          />
        </div>

        {isAdmin && post.status === "removed" && post.removedReason ? (
          <Card className="border-danger/35 bg-danger-bg">
            <p className="text-sm text-danger">
              <span className="font-semibold">Removed by an admin.</span>{" "}
              Reason: {post.removedReason}
            </p>
          </Card>
        ) : null}

        <p className="whitespace-pre-wrap text-pretty text-ink">
          {post.body}
        </p>

        {rows.length > 0 ? (
          <Card>
            {structuredMandate ? (
              <h2 className="mb-3 text-sm font-semibold text-ink">
                Mandate details
              </h2>
            ) : null}
            <dl className="grid gap-2.5 sm:grid-cols-2">
              {rows.map((row) => (
                <div key={row.label}>
                  <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">
                    {row.label}
                  </dt>
                  <dd className="text-sm whitespace-pre-wrap text-ink">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        ) : null}

        {post.taggedMembers.length > 0 ? (
          <div>
            <h2 className="mb-1.5 text-sm font-semibold text-ink">
              Tagged members
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {post.taggedMembers.map((member) => (
                <Tag key={member.id}>{member.name}</Tag>
              ))}
            </div>
          </div>
        ) : null}

        {post.attachments.length > 0 ? (
          <div>
            <h2 className="mb-1.5 text-sm font-semibold text-ink">
              Attachments
            </h2>
            <ul className="grid gap-2">
              {post.attachments.map((attachment) => (
                <li key={attachment.id}>
                  {attachment.purgedAt ? (
                    <div className="flex min-h-tap items-center gap-3 rounded-container border border-border bg-surface-subtle px-3.5 py-2.5">
                      <span
                        aria-hidden="true"
                        className="grid size-9 flex-none place-items-center rounded-control bg-surface-subtle text-ink-secondary"
                      >
                        {"—"}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">
                          {attachment.filename}
                        </span>
                        <span className="block text-xs text-ink-muted">
                          Attachment expired after 60 days
                        </span>
                      </span>
                    </div>
                  ) : (
                    <Link
                      href={`/api/attachments/${attachment.id}`}
                      prefetch={false}
                      className="flex min-h-tap items-center gap-3 rounded-container border border-border bg-surface px-3.5 py-2.5 hover:bg-surface-subtle"
                    >
                      <span
                        aria-hidden="true"
                        className="grid size-9 flex-none place-items-center rounded-control bg-surface-subtle text-ink-secondary"
                      >
                        {"⤓"}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">
                          {attachment.filename}
                        </span>
                        <span className="block text-xs text-ink-muted">
                          Protected attachment · {formatBytes(attachment.sizeBytes)}
                        </span>
                      </span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {canEdit ? (
          <EditPostForm
            postId={post.id}
            type={post.type}
            title={post.title}
            body={post.body}
            metadata={post.metadata}
          />
        ) : null}

        {isAdmin && post.attachments.length > 0 ? (
          <AdminRetentionControl
            postId={post.id}
            exempt={post.retentionExempt}
          />
        ) : null}

        {isAdmin && post.status !== "removed" ? (
          <AdminRemoveControl postId={post.id} />
        ) : null}
      </article>

      <hr className="my-6 border-border" />

      <CommentsSection
        postId={post.id}
        comments={post.comments}
        viewerId={viewer!.id}
        isAdmin={isAdmin}
        commentsEnabled={capabilities.comments && post.status !== "removed"}
      />
    </div>
  );
}
