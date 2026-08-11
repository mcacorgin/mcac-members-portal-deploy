import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { listMembersAdmin } from "@/lib/admin/queries";
import type { Viewer } from "@/lib/authz";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  ScreenId,
  Select,
  StatusBadge,
  type Status,
} from "@/components/ui";
import { formatDate } from "../../format";
import { SuspendButton } from "./suspend-button";
import { UnlinkLinkedInButton } from "./unlink-linkedin-button";
import { ModerationSection } from "./moderation";
import { RoleControl } from "./role-control";

export const metadata = { title: "Members - MCAC Members Portal" };

const STATUSES: Viewer["status"][] = [
  "pending",
  "approved",
  "needs_changes",
  "rejected",
  "suspended",
];

const BADGE: Record<string, Status> = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  needs_changes: "needs-changes",
  suspended: "suspended",
};

const STATUS_LABELS: Record<Viewer["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  needs_changes: "Needs changes",
  rejected: "Rejected",
  suspended: "Suspended",
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    status?: string | string[];
    page?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const q = first(params.q).trim();
  const statusParam = first(params.status);
  const status = STATUSES.includes(statusParam as Viewer["status"])
    ? (statusParam as Viewer["status"])
    : undefined;
  const page = Math.max(1, Number.parseInt(first(params.page) || "1", 10) || 1);

  const viewer = await requireViewer();
  const result = await listMembersAdmin(viewer, { q, status, page });

  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (status) query.set("status", status);
    if (target > 1) query.set("page", String(target));
    const qs = query.toString();
    return `/admin/members${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <div className="mb-1">
        <ScreenId id="ADMIN-04" />
      </div>
      <PageHeader
        title="Members"
        description="Search, review, and export the member base. Open a row for the full record and decisions."
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              href="/admin/members/export?format=csv"
              variant="secondary"
              size="sm"
            >
              Export CSV
            </Button>
            <Button
              href="/admin/members/export?format=xlsx"
              variant="secondary"
              size="sm"
            >
              Export Excel
            </Button>
          </div>
        }
      />

      <form
        method="get"
        action="/admin/members"
        className="mb-4 flex flex-wrap items-end gap-2"
      >
        <div className="min-w-48 flex-1">
          <label htmlFor="member-search" className="sr-only">
            Search members by name or email
          </label>
          <Input
            id="member-search"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by name or email"
          />
        </div>
        <div className="w-44">
          <label htmlFor="member-status" className="sr-only">
            Filter by status
          </label>
          <Select id="member-status" name="status" defaultValue={status ?? ""}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {!result.ok ? (
        <ErrorState
          title="Could not load members"
          body={result.message}
        />
      ) : result.data.rows.length === 0 ? (
        <EmptyState
          title={q || status ? "No members match" : "No members yet"}
          body={
            q || status
              ? "Try a different search or clear the filters."
              : "Accounts appear here as soon as people register."
          }
          action={
            q || status ? (
              <Button href="/admin/members" variant="secondary">
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mb-2 text-xs text-ink-muted sm:hidden">
            Swipe horizontally to see every member column.
          </p>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-muted">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">City</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody data-testid="members-table">
                {result.data.rows.map((row) => {
                  // An administrator cannot suspend themselves, so their own
                  // row can end up with no control at all. Whether the cell is
                  // empty is decided once, here, so the placeholder cannot go
                  // missing for a case nobody thought of.
                  const canSuspend =
                    row.status === "approved" && row.id !== viewer?.id;
                  const canUnlink = row.linkedInLinked;
                  const canChangeRole =
                    viewer?.role === "superadmin" && row.role !== "superadmin";
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border last:border-b-0 hover:bg-surface-subtle"
                    >
                      <td className="p-0 font-medium text-ink">
                        <Link
                          href={`/admin/applications/${row.id}`}
                          className="flex min-h-tap items-center px-4 py-2.5 hover:underline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-navy"
                        >
                          {row.name || "Unnamed account"}
                          {row.role !== "member" ? (
                            <span className="ml-2 rounded-full bg-navy-tint px-2 py-0.5 text-[11px] font-medium text-navy-text">
                              {row.role === "superadmin" ? "Super admin" : "Admin"}
                            </span>
                          ) : null}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-ink-secondary">
                        {row.email}
                      </td>
                      <td className="px-4 py-2.5 text-ink-secondary">
                        {row.city || "-"}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={BADGE[row.status]} />
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-ink-secondary">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col gap-1.5">
                          {canSuspend ? (
                            <SuspendButton userId={row.id} name={row.name} />
                          ) : null}
                          {canUnlink ? (
                            <UnlinkLinkedInButton
                              userId={row.id}
                              name={row.name}
                            />
                          ) : null}
                          {canChangeRole ? (
                            <RoleControl
                              userId={row.id}
                              name={row.name}
                              role={row.role === "admin" ? "admin" : "member"}
                            />
                          ) : null}
                          {!canSuspend && !canUnlink && !canChangeRole ? (
                            <span className="text-xs text-ink-muted">-</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-ink-muted">
              {result.data.total} account{result.data.total === 1 ? "" : "s"}
              {" - "}page {result.data.page} of{" "}
              {Math.max(1, Math.ceil(result.data.total / result.data.pageSize))}
            </p>
            <div className="flex gap-2">
              {result.data.page > 1 ? (
                <Button
                  href={pageHref(result.data.page - 1)}
                  variant="secondary"
                  size="sm"
                >
                  Previous
                </Button>
              ) : null}
              {result.data.page * result.data.pageSize < result.data.total ? (
                <Button
                  href={pageHref(result.data.page + 1)}
                  variant="secondary"
                  size="sm"
                >
                  Next
                </Button>
              ) : null}
            </div>
          </div>
        </>
      )}

      {viewer ? <ModerationSection admin={viewer} /> : null}
    </div>
  );
}
