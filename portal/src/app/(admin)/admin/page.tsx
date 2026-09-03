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
        <>
          <ul
            className="grid gap-3 md:hidden"
            data-testid="review-queue-mobile"
          >
            {queue.data.map((row) => {
              const name = row.name || "Unnamed applicant";
              return (
                <li key={row.id}>
                  <Link
                    href={`/admin/applications/${row.id}`}
                    aria-label={`Review application from ${name}`}
                    className="ui-review-card block min-h-tap rounded-container border border-border bg-surface p-4 shadow-card transition-[background-color,border-color,scale] duration-150 ease-out-strong active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{name}</p>
                        <p className="mt-0.5 truncate text-sm text-ink-secondary">
                          {row.email}
                        </p>
                      </div>
                      <StatusBadge
                        status={
                          row.status === "needs_changes"
                            ? "needs-changes"
                            : "pending"
                        }
                      />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-ink-muted">Submitted</dt>
                        <dd className="text-ink-secondary">
                          {formatDate(row.createdAt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ink-muted">City</dt>
                        <dd className="text-ink-secondary">{row.city || "—"}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-xs text-ink-muted">Privacy notice</dt>
                        <dd
                          className={
                            row.consented ? "text-success" : "text-warning"
                          }
                        >
                          {row.consented
                            ? "Accepted current notice"
                            : "Not yet accepted"}
                        </dd>
                      </div>
                    </dl>
                    <span className="mt-4 flex min-h-tap items-center justify-between border-t border-border pt-3 font-semibold text-navy-text">
                      Review application
                      <span aria-hidden="true">&rarr;</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <Card className="ui-table-card relative hidden overflow-x-auto p-0 md:block">
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
                    className="ui-table-row border-b border-border last:border-b-0 hover:bg-surface-subtle"
                  >
                    <td className="px-4 py-2.5 font-medium text-ink">
                      {name}
                    </td>
                    <td className="px-4 py-2.5 text-ink-secondary">
                      {row.email}
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
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <Link
                        href={`/admin/applications/${row.id}`}
                        aria-label={`Review application from ${name}`}
                        className="inline-flex min-h-tap items-center gap-1 font-medium text-navy hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                      >
                        Review
                        <span aria-hidden="true">&rarr;</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </Card>
        </>
      )}
    </div>
  );
}
