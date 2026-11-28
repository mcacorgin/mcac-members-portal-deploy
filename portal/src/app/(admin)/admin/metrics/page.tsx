import Link from "next/link";
import { Card, ErrorState, PageHeader } from "@/components/ui";
import { getAdminMetrics } from "@/lib/admin/metrics";
import { requireViewer } from "@/lib/auth";

export const metadata = { title: "Metrics - MCAC Members Portal" };

const MEMBER_STATUSES = [
  ["approved", "Approved"],
  ["awaiting_payment", "Awaiting payment"],
  ["pending", "Pending"],
  ["needs_changes", "Needs changes"],
  ["suspended", "Suspended"],
  ["rejected", "Rejected"],
] as const;

const TREND_COLUMNS = [
  ["applications", "New applications"],
  ["paid", "Paid activations"],
  ["opportunity", "Business Opportunities"],
  ["job", "Jobs"],
  ["knowledge", "Knowledge"],
  ["event", "Events"],
  ["comments", "Comments"],
] as const;

const weekLabel = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export default async function AdminMetricsPage() {
  const result = await getAdminMetrics(await requireViewer());

  if (!result.ok) {
    return <ErrorState title="Could not load metrics" body={result.message} />;
  }

  const { statuses, weeks, contributors } = result.data;
  const contentTotals = weeks.map(
    (week) => week.opportunity + week.job + week.knowledge + week.event + week.comments,
  );
  const maxContent = Math.max(1, ...contentTotals);

  return (
    <div className="grid gap-4">
      <PageHeader title="Metrics" description="Membership and portal activity." />

      <Card aria-labelledby="active-now">
        <h2 id="active-now" className="font-semibold text-ink">Live users today</h2>
        <p className="mt-2 text-sm text-ink-secondary">
          Sign-in and visit counts are unavailable for today, the last 7 days and the last 30 days.
        </p>
      </Card>

      <Card aria-labelledby="membership-counts">
        <h2 id="membership-counts" className="font-semibold text-ink">Members by status</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {MEMBER_STATUSES.map(([status, label]) => (
            <div key={status}>
              <dt className="text-sm text-ink-secondary">{label}</dt>
              <dd className="text-2xl font-semibold tabular-nums text-ink">
                {statuses.find((row) => row.status === status)?.total ?? 0}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card aria-labelledby="weekly-activity">
        <h2 id="weekly-activity" className="font-semibold text-ink">Last 12 weeks</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Weeks start Monday in India time. The current week is still in progress.
          Applications count recorded first submissions. Paid activations include returning members.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-ink-muted">
                <th scope="col" className="p-2">Week of</th>
                {TREND_COLUMNS.map(([key, label]) => (
                  <th key={key} scope="col" className="p-2 text-right">{label}</th>
                ))}
                <th scope="col" className="min-w-24 p-2">Content trend</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, index) => (
                <tr key={week.week} className="border-b border-border last:border-b-0">
                  <th scope="row" className="whitespace-nowrap p-2 font-medium">
                    <time dateTime={week.week}>{weekLabel.format(new Date(week.week))}</time>
                  </th>
                  {TREND_COLUMNS.map(([key]) => (
                    <td key={key} className="p-2 text-right tabular-nums">{week[key]}</td>
                  ))}
                  <td className="p-2">
                    <meter
                      aria-label="Posts and comments"
                      className="block h-3 w-full"
                      min={0}
                      max={maxContent}
                      value={contentTotals[index]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card aria-labelledby="top-contributors">
        <h2 id="top-contributors" className="font-semibold text-ink">Most active members</h2>
        <p className="mt-1 text-sm text-ink-secondary">Ranked by posts and comments over the last 30 days.</p>
        {contributors.length ? (
          <ol className="mt-3 divide-y divide-border">
            {contributors.map((member) => (
              <li key={member.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                <Link
                  className="font-medium text-navy-text underline"
                  href={`/admin/applications/${member.id}`}
                >
                  {member.name || "Unnamed member"}
                </Link>
                <span className="text-ink-secondary">
                  {member.posts} posts · {member.comments} comments
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-ink-secondary">No recorded posts or comments in this period.</p>
        )}
      </Card>
    </div>
  );
}
