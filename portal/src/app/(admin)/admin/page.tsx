import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { getAdminOverview, listReviewQueue } from "@/lib/admin/queries";
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  ScreenId,
  StatusBadge,
} from "@/components/ui";
import { formatDate } from "../format";

export const metadata = { title: "Admin overview - MCAC Members Portal" };

const STATS = [
  { key: "pendingCount", label: "Pending review", testId: "stat-pending" },
  {
    key: "needsChangesCount",
    label: "Needs changes",
    testId: "stat-needs-changes",
  },
  { key: "memberCount", label: "Approved members", testId: "stat-members" },
  { key: "suspendedCount", label: "Suspended", testId: "stat-suspended" },
] as const;

export default async function AdminOverviewPage() {
  const viewer = await requireViewer();
  const [overview, queue] = await Promise.all([
    getAdminOverview(viewer),
    listReviewQueue(viewer),
  ]);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <ScreenId id="ADMIN-01" />
      </div>
      <PageHeader
        title="Overview"
        description="Applications waiting on a decision, and the state of the member base."
      />

      {overview.ok ? (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STATS.map((stat) => (
            <Card
              key={stat.key}
              data-testid={stat.testId}
              className="ui-stat-card"
            >
              <span className="block text-2xl font-semibold text-ink">
                {overview.data[stat.key]}
              </span>
              <span className="block text-sm text-ink-secondary">
                {stat.label}
              </span>
            </Card>
          ))}
        </div>
      ) : (
        <ErrorState
          className="mb-6"
          title="Could not load the overview counts"
          body={overview.message}
        />
      )}

      <h3 className="mb-3 text-base font-semibold text-ink">Review queue</h3>
      {!queue.ok ? (
        <ErrorState
          title="Could not load the review queue"
          body={queue.message}
        />
      ) : queue.data.length === 0 ? (
        <EmptyState
          glyph="✓"
          title="No applications waiting"
          body="New registrations appear here as soon as they are submitted."
        />
      ) : (
        <Card className="ui-table-card relative overflow-x-auto p-0">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-ink-muted">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Privacy notice</th>
                <th className="px-4 py-3 text-right font-medium">Review</th>
              </tr>
            </thead>
            <tbody data-testid="review-queue">
              {queue.data.map((row) => {
                const name = row.name || "Unnamed applicant";
                return (
                  <tr
                    key={row.id}
                    className="ui-table-row relative border-b border-border last:border-b-0 hover:bg-surface-subtle"
                  >
                    {/*
                      Row-link overlay pattern: the ONLY interactive element in
                      the row is this anchor. Its own content (the name) stays
                      in normal flow inside this cell; a `::after` pseudo-
                      element is what's absolutely positioned to `inset-0`,
                      stretching the click/tap target across the whole row.
                      That pseudo needs a positioned containing block, which
                      is the `<tr>` above (position: relative works reliably
                      on table rows in evergreen Chrome/Firefox/Safari - this
                      is the same "extend the hit area with a pseudo-element"
                      technique as better-accessibility's hit-area guidance,
                      just stretched to the full row instead of a small
                      target). A row-Link-wrapper (`<Link>` around `<tr>`) was
                      the alternative, but `<tr>` cannot be a child of
                      anything but `<table>`/`<tbody>` in valid HTML, so that
                      pattern is not legal here. Every other cell stays plain
                      text/markup - no second interactive element, so no
                      nested-interactive violation.
                    */}
                    <td className="px-4 py-2.5 font-medium text-ink">
                      <Link
                        href={`/admin/applications/${row.id}`}
                        aria-label={`Review application from ${name}`}
                        className="after:absolute after:inset-0 after:z-[1] after:content-[''] hover:underline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-navy"
                      >
                        {name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-ink-secondary">
                      {/*
                        Carved out of the row-link overlay: the overlay's
                        `::after` sits at z-[1] in the ambient stacking
                        context shared with this `<td>` (neither `<tr>` nor
                        `<td>` sets a z-index of its own, so no new stacking
                        context isolates them). A `relative z-[2]` wrapper
                        here paints above that pseudo-element, so this is the
                        one span in the row where clicking, dragging to
                        select, and copying behave like plain text instead of
                        triggering navigation - the email is the value an
                        admin most plausibly needs to copy out of this table.
                      */}
                      <span className="relative z-[2]">{row.email}</span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-secondary">
                      {row.city || "-"}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-ink-secondary">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        status={
                          row.status === "needs_changes"
                            ? "needs-changes"
                            : "pending"
                        }
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      {row.consented ? (
                        <span className="text-success">
                          Accepted current notice
                        </span>
                      ) : (
                        <span className="text-warning">Not yet accepted</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap text-navy">
                      {/*
                        Decorative only: the row's one link already carries
                        the full accessible name ("Review application from
                        {name}"). Hiding this avoids announcing "Review"
                        twice per row for screen-reader users.
                      */}
                      <span
                        aria-hidden="true"
                        className="inline-flex items-center gap-1 font-medium"
                      >
                        Review
                        <span>&rarr;</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
